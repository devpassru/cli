import { resolveAuthUrl, runUnifiedLogin } from "@devpass/cli-core";
import { RunDeployClient } from "../api.js";
import { clearCredentials, resolveApiUrl, resolveAuthToken } from "../config.js";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";
import { c } from "../ui.js";

export async function runLogin(
  flags: CommonFlags & { tokenArg?: string; noBrowser?: boolean; authUrl?: string },
): Promise<void> {
  const apiUrl = await resolveApiUrl(flags.apiUrl);
  const authUrl = resolveAuthUrl(flags.authUrl);

  await runUnifiedLogin({
    client: "rundeploy",
    title: "Авторизация в RunDeploy / DevPass",
    tokenArg: flags.tokenArg,
    tokenFlag: flags.token,
    noBrowser: flags.noBrowser,
    authUrl,
    verifyToken: async (token) => {
      const client = new RunDeployClient({ baseUrl: apiUrl, token });
      const me = await client.me();
      return {
        email: me.user.email,
        details: `тариф: ${c.cyan(me.entitlements.tier)}`,
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
    throw new Error("Вы не авторизованы. Выполните `rundeploy login`.");
  }
  const client = await createAuthenticatedClient(flags);
  const me = await client.me();
  console.log(`${c.bold(me.user.email)} (${me.user.id})`);
  console.log(
    `Тариф: ${c.cyan(me.entitlements.tier)} · Проектов: до ${me.entitlements.projects_limit} · Лимит сборки: ${me.entitlements.max_bundle_mb} МБ`,
  );
}
