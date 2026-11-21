# DimeApp

## Telegram bot menu

The service registers its Telegram webhook on startup using `TELEGRAM_BOT_TOKEN` and `RAILWAY_PUBLIC_DOMAIN` (or `TELEGRAM_WEBHOOK_URL`).

The `/start` command sends one welcome message with an inline two-column button menu:
- **Заработать** — edits the same message to show the user's personal invite link and the stated reward of 2 ⭐️ per invited friend.
- **Канал** — opens the URL configured in `DIME_CHANNEL_URL`.
- **Купить подарок** and **Профиль** — currently show an alert that these sections are not connected yet.

Set `DIME_CHANNEL_URL` in Railway Variables to the public Telegram channel URL.

Note: referral-link display is implemented; automatic referral attribution and reward crediting are not implemented yet.
