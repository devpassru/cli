#!/usr/bin/env node
import { parseArgs } from "node:util";
import { ApiError } from "./api.js";
import { runDeploy } from "./commands/deploy.js";
import { runDomainsCommand } from "./commands/domains.js";
import { runEnvCommand } from "./commands/env.js";
import { runLogin, runLogout, runWhoami } from "./commands/login.js";
import { runLogs } from "./commands/logs.js";
import { runProjectsList } from "./commands/projects.js";
import { runRollback } from "./commands/rollback.js";
import { c, printError } from "./ui.js";

const VERSION = "0.1.1";

function printHelp(): void {
  console.log(`${c.bold("rundeploy")} v${VERSION} — CLI для деплоя на RunDeploy (https://rundeploy.ru)

${c.bold("Использование:")}
  rundeploy [dir] [опции]             Быстрый деплой сборки (по умолчанию dist/build/out)
  rundeploy deploy [dir] [опции]      То же самое явно
  rundeploy login [token]             Сохранить API-ключ DevPass (dp_live_...)
  rundeploy logout                    Удалить локальные учетные данные
  rundeploy whoami                    Показать текущего пользователя и тариф
  rundeploy projects                  Список проектов
  rundeploy rollback [dep_id]         Откат на предыдущий или указанный релиз
  rundeploy env <ls|set|rm>           Управление переменными окружения проекта
  rundeploy domains <ls|add|verify|rm> Управление кастомными доменами
  rundeploy logs [--limit 20]         Логи serverless-функций (/api/*)

${c.bold("Опции:")}
  -n, --name <slug>       Имя (поддомен) проекта (<slug>.rundeploy.ru)
  -p, --project <id>      ID проекта (prj_...)
  -t, --token <token>     API-ключ (dp_live_...) или Deploy Token (rdp_...)
  -m, --message <text>    Сообщение релиза
      --api-url <url>     Базовый URL API (по умолчанию https://rundeploy.ru)
      --no-spa            Отключить SPA fallback (/index.html) при создании проекта
      --no-api            Не включать соседнюю папку api/ в архив
      --limit <n>         Количество записей логов (для logs)
  -v, --version           Показать версию
  -h, --help              Показать справку
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      name: { type: "string", short: "n" },
      project: { type: "string", short: "p" },
      token: { type: "string", short: "t" },
      message: { type: "string", short: "m" },
      "api-url": { type: "string" },
      "no-spa": { type: "boolean" },
      "no-api": { type: "boolean" },
      limit: { type: "string" },
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
    project: typeof values.project === "string" ? values.project : undefined,
    name: typeof values.name === "string" ? values.name : undefined,
  };

  const [cmd, ...rest] = positionals;

  switch (cmd) {
    case undefined:
      await runDeploy({
        ...commonFlags,
        spa: !values["no-spa"],
        includeApi: !values["no-api"],
        message: typeof values.message === "string" ? values.message : undefined,
      });
      break;

    case "deploy":
      await runDeploy({
        ...commonFlags,
        dir: rest[0],
        spa: !values["no-spa"],
        includeApi: !values["no-api"],
        message: typeof values.message === "string" ? values.message : undefined,
      });
      break;

    case "login":
      await runLogin({ ...commonFlags, tokenArg: rest[0] });
      break;

    case "logout":
      await runLogout();
      break;

    case "whoami":
      await runWhoami(commonFlags);
      break;

    case "projects":
    case "ls":
      await runProjectsList(commonFlags);
      break;

    case "rollback":
      await runRollback({ ...commonFlags, deploymentId: rest[0] });
      break;

    case "env":
      await runEnvCommand(rest[0], rest.slice(1), commonFlags);
      break;

    case "domains":
      await runDomainsCommand(rest[0], rest.slice(1), commonFlags);
      break;

    case "logs":
      await runLogs({
        ...commonFlags,
        limit: typeof values.limit === "string" ? Number(values.limit) : undefined,
      });
      break;

    default:
      // Treat unknown positional as build directory: `rundeploy ./dist`
      await runDeploy({
        ...commonFlags,
        dir: cmd,
        spa: !values["no-spa"],
        includeApi: !values["no-api"],
        message: typeof values.message === "string" ? values.message : undefined,
      });
      break;
  }
}

main().catch((err: unknown) => {
  if (err instanceof ApiError) {
    printError(`${err.message}${err.code ? c.dim(` [${err.code}]`) : ""}`);
  } else if (err instanceof Error) {
    printError(err.message);
  } else {
    printError(String(err));
  }
  process.exit(1);
});
