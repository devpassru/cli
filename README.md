# DevPass CLI Tools

Официальный монорепозиторий CLI-инструментов экосистемы [DevPass](https://devpass.ru).

Все CLI используют единую авторизацию через браузер (`id.devpass.ru`) и общий файл учётных данных `~/.config/devpass/credentials.json` — достаточно войти один раз в любом инструменте.

## Пакеты

| Пакет                               | Описание                                                                                    | Запуск                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| [`rundeploy`](./packages/rundeploy) | Деплой статики, SPA, Mini Apps и serverless-функций на [RunDeploy](https://rundeploy.ru)    | `npx @devpass/rundeploy ./dist` |
| [`runport`](./packages/runport)     | SSH-туннели на localhost, логи вебхуков и визуальное ревью на [RunPort](https://runport.ru) | `npx @devpass/runport 3000`     |

## Разработка

```bash
bun install
bun run build
bun run check
```
