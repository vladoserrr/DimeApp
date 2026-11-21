# DimeApp
## Telegram bot menu

The service registers its Telegram webhook on startup using `TELEGRAM_BOT_TOKEN` and `RAILWAY_PUBLIC_DOMAIN` (or `TELEGRAM_WEBHOOK_URL`). The `/start` command displays a reply keyboard with **Пригласить друга** and **Канал | Подарки**. Set `DIME_CHANNEL_URL` in Railway Variables to the public channel URL. The invite button creates a personal deep link for the Telegram user.
