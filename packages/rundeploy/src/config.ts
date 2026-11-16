import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_API_URL = "https://rundeploy.ru";

export interface DevpassCredentials {
  apiKey?: string;
  apiUrl?: string;
  email?: string;
  updatedAt?: string;
}

export interface LocalProjectLink {
  projectId: string;
  slug: string;
  name?: string;
  apiUrl?: string;
}

export function getCredentialsPath(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfig ? resolve(xdgConfig) : join(homedir(), ".config");
  return join(baseDir, "devpass", "credentials.json");
}

export async function readCredentials(): Promise<DevpassCredentials> {
  const path = getCredentialsPath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeCredentials(creds: DevpassCredentials): Promise<string> {
  const path = getCredentialsPath();
  const dir = resolve(path, "..");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const payload = JSON.stringify(
    {
      ...creds,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  await writeFile(path, `${payload}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
  return path;
}

export async function clearCredentials(): Promise<void> {
  const path = getCredentialsPath();
  await rm(path, { force: true });
}

export async function resolveAuthToken(explicitToken?: string): Promise<string | null> {
  if (explicitToken?.trim()) return explicitToken.trim();
  if (process.env.RUNDEPLOY_TOKEN?.trim()) return process.env.RUNDEPLOY_TOKEN.trim();
  if (process.env.DEVPASS_TOKEN?.trim()) return process.env.DEVPASS_TOKEN.trim();
  if (process.env.DEVPASS_API_KEY?.trim()) return process.env.DEVPASS_API_KEY.trim();

  const creds = await readCredentials();
  return creds.apiKey?.trim() || null;
}

export async function resolveApiUrl(explicitUrl?: string): Promise<string> {
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/, "");
  if (process.env.RUNDEPLOY_API_URL?.trim()) {
    return process.env.RUNDEPLOY_API_URL.trim().replace(/\/+$/, "");
  }
  const creds = await readCredentials();
  return (creds.apiUrl?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
}

export function getLocalLinkPath(cwd: string = process.cwd()): string {
  return join(resolve(cwd), ".rundeploy", "project.json");
}

export async function readLocalProjectLink(
  cwd: string = process.cwd(),
): Promise<LocalProjectLink | null> {
  try {
    const raw = await readFile(getLocalLinkPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalProjectLink>;
    if (parsed.projectId && parsed.slug) {
      return {
        projectId: parsed.projectId,
        slug: parsed.slug,
        name: parsed.name,
        apiUrl: parsed.apiUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeLocalProjectLink(
  link: LocalProjectLink,
  cwd: string = process.cwd(),
): Promise<string> {
  const path = getLocalLinkPath(cwd);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(link, null, 2)}\n`, "utf8");
  return path;
}
