import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  clearCredentials,
  getCredentialsPath,
  readCredentials,
  resolveAuthToken as resolveSharedAuthToken,
  writeCredentials,
} from "@devpass/cli-core";

export const DEFAULT_API_URL = "https://rundeploy.ru";

export { clearCredentials, getCredentialsPath, readCredentials, writeCredentials };

export interface LocalProjectLink {
  projectId: string;
  slug: string;
  name?: string;
  apiUrl?: string;
}

export async function resolveAuthToken(explicitToken?: string): Promise<string | null> {
  return resolveSharedAuthToken(explicitToken, ["RUNDEPLOY_TOKEN"]);
}

export async function resolveApiUrl(explicitUrl?: string): Promise<string> {
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/, "");
  if (process.env.RUNDEPLOY_API_URL?.trim()) {
    return process.env.RUNDEPLOY_API_URL.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_URL;
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
