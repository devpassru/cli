import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { RunDeployClient } from "../api.js";
import {
  clearCredentials,
  DEFAULT_API_URL,
  resolveApiUrl,
  resolveAuthToken,
  writeCredentials,
} from "../config.js";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";
import { c } from "../ui.js";

export async function runLogin(flags: CommonFlags & { tokenArg?: string }): Promise<void> {
  const apiUrl = await resolveApiUrl(flags.apiUrl);
  let token = flags.tokenArg?.trim() || flags.token?.trim();

  if (!token) {
    console.log(c.bold("Авторизация в RunDeploy / DevPass"));
    console.log(
      `Получите API-ключ (${c.cyan("dp_live_...")}) в настройках профиля: ${c.cyan("https://id.devpass.ru")}`,
    );
    const rl = createInterface({ input, output });
    try {
      token = (await rl.question("Введите API-ключ: ")).trim();
    } finally {
      rl.close();
    }
  }

  if (!token) {
    throw new Error("API-ключ не введен.");
  }

  const client = new RunDeployClient({ baseUrl: apiUrl, token });
  const me = await client.me();

  const savedPath = await writeCredentials({
    apiKey: token,
    apiUrl: apiUrl === DEFAULT_API_URL ? undefined : apiUrl,
    email: me.user.email,
  });

  console.log(
    `${c.green("✓")} Вы вошли как ${c.bold(me.user.email)} (тариф: ${c.cyan(me.entitlements.tier)})`,
  );
  console.log(c.dim(`Ключ сохранен в ${savedPath}`));
}

export async function runLogout(): Promise<void> {
  await clearCredentials();
  console.log(`${c.green("✓")} Локальные учетные данные удалены.`);
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
