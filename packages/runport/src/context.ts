import { RunPortClient } from "./api.js";
import { resolveApiUrl, resolveAuthToken } from "./config.js";

export interface CommonFlags {
  token?: string;
  apiUrl?: string;
}

export async function createAuthenticatedClient(flags: CommonFlags): Promise<RunPortClient> {
  const token = await resolveAuthToken(flags.token);
  if (!token) {
    throw new Error(
      "Вы не авторизованы. Выполните `runport login` или передайте `--token <dp_live_...>`.",
    );
  }
  const baseUrl = resolveApiUrl(flags.apiUrl);
  return new RunPortClient({ baseUrl, token });
}
