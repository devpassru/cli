# rundeploy

Официальный CLI для мгновенного деплоя статических сайтов, SPA, Telegram Mini Apps и serverless-функций (`/api/*`) на [RunDeploy](https://rundeploy.ru).

## Быстрый старт

```bash
# Авторизация через API-ключ DevPass (dp_live_...)
npx rundeploy login

# Деплой папки сборки (автоопределение dist/build/out)
npx rundeploy ./dist --name my-app
```

После первого деплоя проект привязывается к `.rundeploy/project.json`, и следующие релизы выполняются одной командой:

```bash
npx rundeploy
```

## Команды

- `rundeploy [dir]` / `rundeploy deploy [dir]` — упаковать и задеплоить сайт
  - `--name <slug>` — указать/создать проект по поддомену (`<slug>.rundeploy.ru`)
  - `--project <id>` — указать ID проекта (`prj_...`)
  - `--no-spa` — отключить SPA fallback (`/index.html`) при создании проекта
  - `--no-api` — не включать соседнюю папку `api/` в деплой
- `rundeploy login` / `logout` / `whoami` — управление авторизацией (`~/.config/devpass/credentials.json`)
- `rundeploy projects` — список проектов
- `rundeploy rollback [dep_id]` — мгновенный откат на предыдущий или указанный релиз
- `rundeploy env ls|set|rm` — управление зашифрованными переменными окружения
- `rundeploy domains ls|add|verify|rm` — привязка кастомных доменов и проверка DNS
- `rundeploy logs [--limit 20]` — логи serverless-функций

## CI/CD (GitHub Actions / GitLab CI)

Для автоматических деплоев используйте scoped Deploy Token (`rdp_...`) из настроек проекта:

```bash
RUNDEPLOY_TOKEN=rdp_... npx rundeploy ./dist --project prj_...
```
