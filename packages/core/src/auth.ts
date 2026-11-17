import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { hostname } from "node:os";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { DEFAULT_AUTH_URL, writeCredentials } from "./config.js";
import { c } from "./ui.js";

function renderCallbackHtml(params: { ok: boolean; title: string; message: string }): string {
  const accent = params.ok ? "#f59e0b" : "#ef4444";
  const badge = params.ok ? "✓" : "✕";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${params.title} — DevPass CLI</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#0f1014; color:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
    .card { max-width:420px; width:90%; background:#14151b; border:1px solid #252835;
      border-radius:16px; padding:32px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.45); }
    .icon { width:48px; height:48px; margin:0 auto 16px; border-radius:12px; display:flex;
      align-items:center; justify-content:center; font-size:22px; font-weight:700;
      background:${accent}22; color:${accent}; border:1px solid ${accent}44; }
    h1 { font-size:18px; margin:0 0 8px; }
    p { font-size:14px; color:#9ca3af; margin:0; line-height:1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${badge}</div>
    <h1>${params.title}</h1>
    <p>${params.message}</p>
  </div>
</body>
</html>`;
}

export async function openBrowser(url: string): Promise<boolean> {
  const platform = process.platform;
  let cmd = "xdg-open";
  let args = [url];

  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: "ignore",
      });
      child.once("error", () => resolve(false));
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

export interface BrowserLoginResult {
  apiKey: string;
  email: string;
  userId: string;
}

export async function loginWithBrowser(options: {
  client: string;
  authUrl?: string;
  deviceName?: string;
  timeoutMs?: number;
  openUrl?: (url: string) => Promise<boolean>;
}): Promise<BrowserLoginResult> {
  const authUrl = (options.authUrl || DEFAULT_AUTH_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const deviceName = options.deviceName || hostname();
  const state = randomBytes(24).toString("hex");

  return new Promise<BrowserLoginResult>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (err: Error | null, result?: BrowserLoginResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      server.close();
      if (err) reject(err);
      else if (result) resolve(result);
    };

    const server = createServer(async (req, res) => {
      const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const errorParam = reqUrl.searchParams.get("error");
      const returnedState = reqUrl.searchParams.get("state");
      const code = reqUrl.searchParams.get("code");

      if (errorParam) {
        const html = renderCallbackHtml({
          ok: false,
          title: "Вход отменён",
          message: "Вы отменили авторизацию в браузере. Можете закрыть эту вкладку.",
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        finish(new Error("Авторизация отменена пользователем."));
        return;
      }

      if (!returnedState || returnedState !== state || !code) {
        const html = renderCallbackHtml({
          ok: false,
          title: "Ошибка проверки",
          message: "Некорректный state или отсутствует код авторизации.",
        });
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        finish(new Error("Некорректный ответ авторизации (state mismatch или отсутствует code)."));
        return;
      }

      const address = server.address() as AddressInfo;
      const redirectUri = `http://127.0.0.1:${address.port}/callback`;

      try {
        const tokenRes = await fetch(`${authUrl}/api/v1/cli/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri,
            deviceName,
          }),
        });
        const tokenData = (await tokenRes.json().catch(() => ({}))) as {
          apiKey?: string;
          email?: string;
          userId?: string;
          error?: string;
        };

        if (!tokenRes.ok || !tokenData.apiKey || !tokenData.email || !tokenData.userId) {
          throw new Error(tokenData.error || `HTTP ${tokenRes.status}`);
        }

        const html = renderCallbackHtml({
          ok: true,
          title: "Вход выполнен",
          message: `Вы вошли как ${tokenData.email}. Можете закрыть эту вкладку и вернуться в терминал.`,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);

        finish(null, {
          apiKey: tokenData.apiKey,
          email: tokenData.email,
          userId: tokenData.userId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось получить API-ключ";
        const html = renderCallbackHtml({
          ok: false,
          title: "Ошибка авторизации",
          message,
        });
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        finish(new Error(message));
      }
    });

    server.on("error", (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });

    server.listen(0, "127.0.0.1", async () => {
      const address = server.address() as AddressInfo;
      const redirectUri = `http://127.0.0.1:${address.port}/callback`;
      const loginUrl = new URL(`${authUrl}/cli/auth`);
      loginUrl.searchParams.set("redirect_uri", redirectUri);
      loginUrl.searchParams.set("state", state);
      loginUrl.searchParams.set("client", options.client);

      const urlString = loginUrl.toString();
      console.log(`Откройте ссылку в браузере для входа в DevPass:`);
      console.log(`  ${c.cyan(urlString)}`);

      const opener = options.openUrl || openBrowser;
      const opened = await opener(urlString);
      if (opened) {
        console.log(c.dim("Браузер открыт. Ожидаем подтверждение..."));
      } else {
        console.log(c.dim("Не удалось открыть браузер автоматически — перейдите по ссылке выше."));
      }

      timer = setTimeout(() => {
        finish(new Error("Истекло время ожидания авторизации в браузере (5 мин)."));
      }, timeoutMs);
    });
  });
}

export async function promptForToken(authUrl = DEFAULT_AUTH_URL): Promise<string> {
  console.log(
    `Получите API-ключ (${c.cyan("dp_live_...")}) в настройках профиля: ${c.cyan(authUrl)}`,
  );
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("Введите API-ключ: ")).trim();
  } finally {
    rl.close();
  }
}

export async function runUnifiedLogin(options: {
  client: string;
  title: string;
  tokenArg?: string;
  tokenFlag?: string;
  noBrowser?: boolean;
  authUrl?: string;
  verifyToken?: (token: string) => Promise<{ email: string; details?: string }>;
}): Promise<{ token: string; email?: string; savedPath: string }> {
  const authUrl = (options.authUrl || DEFAULT_AUTH_URL).replace(/\/+$/, "");
  let token = options.tokenArg?.trim() || options.tokenFlag?.trim();
  let email: string | undefined;

  if (!token) {
    console.log(c.bold(options.title));
    if (options.noBrowser) {
      token = await promptForToken(authUrl);
    } else {
      const res = await loginWithBrowser({
        client: options.client,
        authUrl,
      });
      token = res.apiKey;
      email = res.email;
    }
  }

  if (!token) {
    throw new Error("API-ключ не введен.");
  }

  let details: string | undefined;
  if (options.verifyToken) {
    const verified = await options.verifyToken(token);
    email = verified.email || email;
    details = verified.details;
  }

  const savedPath = await writeCredentials({
    apiKey: token,
    email,
  });

  console.log(
    `${c.green("✓")} Вы вошли как ${c.bold(email || "пользователь DevPass")}${details ? ` (${details})` : ""}`,
  );
  console.log(c.dim(`Единый ключ DevPass сохранён в ${savedPath} (действует для всех CLI)`));

  return { token, email, savedPath };
}
