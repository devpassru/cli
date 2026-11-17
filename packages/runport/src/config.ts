import {
  clearCredentials,
  getCredentialsPath,
  resolveAuthToken as resolveSharedAuthToken,
} from "@devpass/cli-core";

export const DEFAULT_API_URL = "https://app.runport.ru";
export const DEFAULT_SSH_HOST = "srv.runport.ru";
export const DEFAULT_SSH_PORT = 2222;

export { clearCredentials, getCredentialsPath };

export async function resolveAuthToken(explicitToken?: string): Promise<string | null> {
  return resolveSharedAuthToken(explicitToken, ["RUNPORT_TOKEN"]);
}

export function resolveApiUrl(explicitUrl?: string): string {
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/, "");
  if (process.env.RUNPORT_API_URL?.trim()) {
    return process.env.RUNPORT_API_URL.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_URL;
}
