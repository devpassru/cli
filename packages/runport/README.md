# @devpass/runport

Официальный CLI для мгновенных SSH-туннелей, логов вебхуков и визуального ревью на [RunPort](https://runport.ru).

## Быстрый старт

```bash
# 1. Авторизация через браузер (единая для всех CLI DevPass)
npx @devpass/runport login

# 2. Добавить локальный SSH-ключ в аккаунт RunPort
npx @devpass/runport keys add

# 3. Открыть HTTPS-туннель на localhost:3000
npx @devpass/runport 3000
```

## Основные команды

- `runport <port>` — открыть HTTP-туннель на `localhost:<port>` (`-s <subdomain>`, `-r` для `--review`, `-a user:pass`, `-i cidr`)
- `runport login` — войти через браузер в DevPass ID (`--no-browser` для ручного ввода ключа)
- `runport logout` / `runport whoami` — выход / информация об аккаунте и трафике
- `runport ls` / `runport reserve <sub>` / `runport close <sub>` — управление туннелями
- `runport keys <ls|add|rm>` — управление SSH-ключами
- `runport logs` — просмотр последних HTTP-запросов
- `runport reviews <ls|resolve>` — просмотр и закрытие комментариев визуального ревью
