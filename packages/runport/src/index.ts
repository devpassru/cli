#!/usr/bin/env node
import { parseArgs } from "node:util";
import { c, printError } from "@devpass/cli-core";
import { ApiError } from "./api.js";
import { runKeysCommand } from "./commands/keys.js";
import { runLogin, runLogout, runWhoami } from "./commands/login.js";
import { runLogs } from "./commands/logs.js";
import { runReviewsCommand } from "./commands/reviews.js";
import { runTunnel } from "./commands/tunnel.js";
import { runClose, runReserve, runTunnelsList, runUnreserve } from "./commands/tunnels.js";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`${c.bold("runport")} v${VERSION} — CLI для SSH-туннелей и ревью на RunPort (https://runport.ru)

${c.bold("Использование:")}
  runport <port> [опции]               Открыть HTTP-туннель на localhost:<port>
  runport tunnel <port> [опции]        То же самое явно
  runport login [token]                Войти через браузер (или по ключу dp_live_...)
  runport logout                       Удалить локальные учетные данные
  runport whoami                       Показать текущего пользователя, тариф и трафик
  runport ls                           Список активных и зарезервированных туннелей
  runport reserve <subdomain>          Зарезервировать постоянный поддомен (Pro/Business)
  runport unreserve <subdomain>        Удалить резерв поддомена
  runport close <subdomain|port>       Закрыть активный туннель
  runport keys <ls|add|rm>             Управление SSH-ключами аккаунта
  runport logs [--subdomain <sub>]     Логи HTTP-запросов
  runport reviews <ls|resolve>         Комментарии визуального ревью

${c.bold("Опции туннеля:")}
  -s, --subdomain <name>   Постоянный поддомен (<name>.runport.ru)
  -r, --review             Включить режим визуального ревью (?__review=1)
  -a, --auth <user:pass>   Защитить туннель Basic Auth
  -i, --ip <cidr,...>      Разрешённые IP/CIDR
      --tcp                Открыть raw TCP-туннель (Pro/Business)
      --remote-port <port> Удалённый TCP-порт (10000-60000)
      --host <host>        Локальный хост (по умолчанию localhost)
  -k, --key <path>         Путь к приватному SSH-ключу (-i для ssh)
      --ssh-host <host>    SSH-сервер RunPort (по умолчанию srv.runport.ru)
      --ssh-port <port>    SSH-порт RunPort (по умолчанию 2222)

${c.bold("Общие опции:")}
  -t, --token <token>      API-ключ DevPass (dp_live_...)
      --api-url <url>      URL API RunPort (по умолчанию https://app.runport.ru)
      --auth-url <url>     URL DevPass ID (по умолчанию https://id.devpass.ru)
      --no-browser         Ввести API-ключ вручную вместо входа через браузер
      --limit <n>          Количество записей логов
      --status <status>    Фильтр статуса ревью (open | resolved)
  -v, --version            Показать версию
  -h, --help               Показать справку
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      subdomain: { type: "string", short: "s" },
      review: { type: "boolean", short: "r" },
      auth: { type: "string", short: "a" },
      ip: { type: "string", short: "i" },
      tcp: { type: "boolean" },
      "remote-port": { type: "string" },
      host: { type: "string" },
      key: { type: "string", short: "k" },
      "ssh-host": { type: "string" },
      "ssh-port": { type: "string" },
      token: { type: "string", short: "t" },
      name: { type: "string", short: "n" },
      "api-url": { type: "string" },
      "auth-url": { type: "string" },
      "no-browser": { type: "boolean" },
      limit: { type: "string" },
      status: { type: "string" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  if (values.version) {
    console.log(VERSION);
    return;
  }

  const commonFlags = {
    token: typeof values.token === "string" ? values.token : undefined,
    apiUrl: typeof values["api-url"] === "string" ? values["api-url"] : undefined,
  };

  const tunnelFlags = {
    subdomain: typeof values.subdomain === "string" ? values.subdomain : undefined,
    review: Boolean(values.review),
    auth: typeof values.auth === "string" ? values.auth : undefined,
    ip: typeof values.ip === "string" ? values.ip : undefined,
    tcp: Boolean(values.tcp),
    remotePort:
      typeof values["remote-port"] === "string"
        ? Number.parseInt(values["remote-port"], 10)
        : undefined,
    localHost: typeof values.host === "string" ? values.host : undefined,
    identityFile: typeof values.key === "string" ? values.key : undefined,
    sshHost: typeof values["ssh-host"] === "string" ? values["ssh-host"] : undefined,
    sshPort:
      typeof values["ssh-port"] === "string" ? Number.parseInt(values["ssh-port"], 10) : undefined,
  };

  const [cmd, ...rest] = positionals;

  if (!cmd) {
    printHelp();
    return;
  }

  switch (cmd) {
    case "tunnel":
    case "http":
      await runTunnel(rest[0], tunnelFlags);
      break;

    case "tcp":
      await runTunnel(rest[0], { ...tunnelFlags, tcp: true });
      break;

    case "login":
      await runLogin({
        ...commonFlags,
        tokenArg: rest[0],
        noBrowser: Boolean(values["no-browser"]),
        authUrl: typeof values["auth-url"] === "string" ? values["auth-url"] : undefined,
      });
      break;

    case "logout":
      await runLogout();
      break;

    case "whoami":
      await runWhoami(commonFlags);
      break;

    case "ls":
    case "tunnels":
      await runTunnelsList(commonFlags);
      break;

    case "reserve":
      await runReserve(rest[0], commonFlags);
      break;

    case "unreserve":
      await runUnreserve(rest[0], commonFlags);
      break;

    case "close":
      await runClose(rest[0], commonFlags);
      break;

    case "keys":
      await runKeysCommand(rest[0], rest.slice(1), {
        ...commonFlags,
        name: typeof values.name === "string" ? values.name : undefined,
      });
      break;

    case "logs":
      await runLogs({
        ...commonFlags,
        subdomain: typeof values.subdomain === "string" ? values.subdomain : rest[0],
        limit: typeof values.limit === "string" ? Number(values.limit) : undefined,
      });
      break;

    case "reviews":
      await runReviewsCommand(rest[0], rest.slice(1), {
        ...commonFlags,
        subdomain: typeof values.subdomain === "string" ? values.subdomain : undefined,
        status:
          values.status === "open" || values.status === "resolved" ? values.status : undefined,
      });
      break;

    default:
      if (/^\d+$/.test(cmd)) {
        await runTunnel(cmd, tunnelFlags);
      } else {
        throw new Error(`Неизвестная команда: "${cmd}". Запустите \`runport --help\`.`);
      }
      break;
  }
}

main().catch((err: unknown) => {
  if (err instanceof ApiError) {
    printError(`${err.message} (HTTP ${err.status})`);
  } else if (err instanceof Error) {
    printError(err.message);
  } else {
    printError(String(err));
  }
  process.exit(1);
});
