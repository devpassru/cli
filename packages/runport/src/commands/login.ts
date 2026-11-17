import { c, formatBytes, resolveAuthUrl, runUnifiedLogin } from "@devpass/cli-core";
import { RunPortClient } from "../api.js";
import { clearCredentials, resolveApiUrl, resolveAuthToken } from "../config.js";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";

export async function runLogin(
  flags: CommonFlags & { tokenArg?: string; noBrowser?: boolean; authUrl?: string },
): Promise<void> {
  const apiUrl = resolveApiUrl(flags.apiUrl);
  const authUrl = resolveAuthUrl(flags.authUrl);

  await runUnifiedLogin({
    client: "runport",
    title: "Авторизация в RunPort / DevPass",
    tokenArg: flags.tokenArg,
    tokenFlag: flags.token,
    noBrowser: flags.noBrowser,
    authUrl,
    verifyToken: async (token) => {
      const client = new RunPortClient({ baseUrl: apiUrl, token });
      const me = await client.me();
      return {
        email: me.email,
        details: `тариф: ${c.cyan(me.planName || me.planType)}`,
      };
    },
  });
}

export async function runLogout(): Promise<void> {
  await clearCredentials();
  console.log(`${c.green("✓")} Локальные учетные данные DevPass удалены (для всех CLI).`);
}

export async function runWhoami(flags: CommonFlags): Promise<void> {
  const token = await resolveAuthToken(flags.token);
  if (!token) {
    throw new Error("Вы не авторизованы. Выполните `runport login`.");
  }
  const client = await createAuthenticatedClient(flags);
  const me = await client.me();
  console.log(`${c.bold(me.email)} (${me.id})`);
  console.log(
    `Тариф: ${c.cyan(me.planName || me.planType)} · Туннелей: до ${me.maxTunnels} · RPS: ${me.rpsLimit} · Трафик: ${formatBytes(me.bandwidthUsed)} / ${formatBytes(me.bandwidthLimit)}`,
  );
}
