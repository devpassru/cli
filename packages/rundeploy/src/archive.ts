import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const IGNORED_NAMES = new Set(["node_modules", ".git", ".rundeploy", ".DS_Store", "Thumbs.db"]);

function shouldIgnore(name: string): boolean {
  if (IGNORED_NAMES.has(name)) return true;
  if (name === ".env" || name.startsWith(".env.")) return true;
  return false;
}

const BUILD_DIR_CANDIDATES = ["dist", "build", "out", ".output/public", "public"];

export function detectBuildDirectory(cwd: string = process.cwd()): string {
  const absCwd = resolve(cwd);
  for (const candidate of BUILD_DIR_CANDIDATES) {
    const full = resolve(absCwd, candidate);
    if (existsSync(join(full, "index.html"))) {
      return full;
    }
  }
  for (const candidate of BUILD_DIR_CANDIDATES) {
    const full = resolve(absCwd, candidate);
    if (existsSync(full)) {
      return full;
    }
  }
  return absCwd;
}

interface TarEntry {
  archivePath: string;
  content: Buffer;
  mode: number;
  mtimeSec: number;
}

function splitUstarPath(archivePath: string): { name: string; prefix: string } {
  const pathBytes = Buffer.from(archivePath, "utf8");
  if (pathBytes.length <= 100) {
    return { name: archivePath, prefix: "" };
  }

  // Split at '/' so prefix <= 155 bytes and name <= 100 bytes
  const parts = archivePath.split("/");
  for (let i = parts.length - 1; i >= 1; i--) {
    const prefix = parts.slice(0, i).join("/");
    const name = parts.slice(i).join("/");
    if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(name, "utf8") <= 100) {
      return { name, prefix };
    }
  }

  throw new Error(`Путь слишком длинный для tar-архива (>255 байт): ${archivePath}`);
}

function writeOctal(buf: Buffer, offset: number, length: number, value: number): void {
  const oct = Math.max(0, value)
    .toString(8)
    .padStart(length - 1, "0");
  buf.write(oct.slice(-(length - 1)), offset, length - 1, "ascii");
  buf[offset + length - 1] = 0;
}

function createTarHeader(entry: TarEntry): Buffer {
  const header = Buffer.alloc(512, 0);
  const { name, prefix } = splitUstarPath(entry.archivePath);

  header.write(name, 0, 100, "utf8");
  writeOctal(header, 100, 8, entry.mode & 0o777);
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, entry.content.length);
  writeOctal(header, 136, 12, entry.mtimeSec);
  header.fill(0x20, 148, 156); // checksum placeholder (spaces)
  header[156] = 0x30; // '0' regular file
  header.write("ustar", 257, 5, "ascii");
  header[262] = 0;
  header.write("00", 263, 2, "ascii");
  if (prefix) {
    header.write(prefix, 345, 155, "utf8");
  }

  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i] ?? 0;
  }
  const chkStr = checksum.toString(8).padStart(6, "0");
  header.write(chkStr, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

async function collectFiles(
  rootDir: string,
  archivePrefix: string,
  out: TarEntry[],
): Promise<void> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const dirent of entries) {
    if (shouldIgnore(dirent.name)) continue;

    const fullPath = join(rootDir, dirent.name);
    const stat = await lstat(fullPath);

    // Skip symlinks for safety (RunDeploy rejects symlinks in archives)
    if (stat.isSymbolicLink()) continue;

    const relPath = archivePrefix ? posix.join(archivePrefix, dirent.name) : dirent.name;

    if (stat.isDirectory()) {
      await collectFiles(fullPath, relPath, out);
    } else if (stat.isFile()) {
      const content = await readFile(fullPath);
      out.push({
        archivePath: relPath,
        content,
        mode: stat.mode || 0o644,
        mtimeSec: Math.floor(stat.mtimeMs / 1000),
      });
    }
  }
}

export interface BundleResult {
  archive: Buffer;
  filesCount: number;
  uncompressedBytes: number;
  hasIndexHtml: boolean;
  includedApiDir: boolean;
}

export async function createDeployArchive(params: {
  buildDir: string;
  cwd?: string;
  includeApi?: boolean;
}): Promise<BundleResult> {
  const absBuildDir = resolve(params.buildDir);
  const absCwd = resolve(params.cwd || process.cwd());

  const buildStat = await lstat(absBuildDir).catch(() => null);
  if (!buildStat?.isDirectory()) {
    throw new Error(`Каталог сборки не найден: ${absBuildDir}`);
  }

  const entries: TarEntry[] = [];
  await collectFiles(absBuildDir, "", entries);

  let includedApiDir = false;
  if (params.includeApi !== false) {
    const siblingApiDir = resolve(absCwd, "api");
    const isInsideBuild =
      siblingApiDir === absBuildDir || siblingApiDir.startsWith(`${absBuildDir}/`);
    if (!isInsideBuild) {
      const apiStat = await lstat(siblingApiDir).catch(() => null);
      if (apiStat?.isDirectory()) {
        await collectFiles(siblingApiDir, "api", entries);
        includedApiDir = true;
      }
    }
  }

  if (entries.length === 0) {
    throw new Error(`Каталог сборки пуст: ${absBuildDir}`);
  }

  const hasIndexHtml = entries.some((e) => e.archivePath === "index.html");
  const chunks: Buffer[] = [];
  let uncompressedBytes = 0;

  for (const entry of entries) {
    uncompressedBytes += entry.content.length;
    chunks.push(createTarHeader(entry));
    if (entry.content.length > 0) {
      chunks.push(entry.content);
      const remainder = entry.content.length % 512;
      if (remainder !== 0) {
        chunks.push(Buffer.alloc(512 - remainder, 0));
      }
    }
  }

  // Two 512-byte zero blocks mark end of tar archive
  chunks.push(Buffer.alloc(1024, 0));

  const tarBuffer = Buffer.concat(chunks);
  const archive = gzipSync(tarBuffer, { level: 6 });

  return {
    archive,
    filesCount: entries.length,
    uncompressedBytes,
    hasIndexHtml,
    includedApiDir,
  };
}
