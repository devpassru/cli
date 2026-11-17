import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_AUTH_URL = "https://id.devpass.ru";

export interface DevpassCredentials {
  apiKey?: string;
  apiUrl?: string;
  email?: string;
  updatedAt?: string;
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
    return typeof parsed === "object" && parsed !== null ? (parsed as DevpassCredentials) : {};
  } catch {
    return {};
  }
}

export async function writeCredentials(creds: DevpassCredentials): Promise<string> {
  const path = getCredentialsPath();
  const dir = resolve(path, "..");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const existing = await readCredentials();
  const payload = JSON.stringify(
    {
      ...existing,
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

export async function resolveAuthToken(
  explicitToken?: string,
  extraEnvVars: string[] = [],
): Promise<string | null> {
  if (explicitToken?.trim()) return explicitToken.trim();
  for (const envName of extraEnvVars) {
    const val = process.env[envName]?.trim();
    if (val) return val;
  }
  if (process.env.DEVPASS_TOKEN?.trim()) return process.env.DEVPASS_TOKEN.trim();
  if (process.env.DEVPASS_API_KEY?.trim()) return process.env.DEVPASS_API_KEY.trim();

  const creds = await readCredentials();
  return creds.apiKey?.trim() || null;
}

export function resolveAuthUrl(explicitAuthUrl?: string): string {
  if (explicitAuthUrl?.trim()) return explicitAuthUrl.trim().replace(/\/+$/, "");
  if (process.env.DEVPASS_AUTH_URL?.trim()) {
    return process.env.DEVPASS_AUTH_URL.trim().replace(/\/+$/, "");
  }
  return DEFAULT_AUTH_URL;
}
