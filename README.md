# DimeApp

## Telegram bot

The bot registers its webhook on startup using `TELEGRAM_BOT_TOKEN` and `RAILWAY_PUBLIC_DOMAIN` (or `TELEGRAM_WEBHOOK_URL`).

### Main menu
`/start` shows inline buttons: **Заработать**, **Канал**, **Купить подарок**, **Профиль**. The channel button opens https://t.me/+cB3iJtgVuoBjZjBi.

### Profile and promo codes
The profile displays the user's Dime balance, invited users, total reward stars and completed gift purchases. Promo codes can be redeemed from the profile. The owner (Telegram ID in `CASINO_OWNER_TELEGRAM_ID`) creates codes with:
`/createpromo CODE AMOUNT LIMIT`
Use `LIMIT=0` for unlimited activations. The reward is credited to the user's Dime balance through the Donut API.

### Telegram gift shop
The shop loads the current available gifts from Telegram's `getAvailableGifts`, sorts them by ascending Stars price and displays six gifts per page. A user selects a gift and pays through a native Telegram Stars invoice. After successful payment, the bot sends the gift to the buyer's Telegram account. If delivery fails, the bot requests a Stars refund.

### Persistent data
Referral counts, promo redemptions, gift purchase counts and pending orders are stored in `/app/data/telegram-store.json` by default. **Attach a Railway Volume mounted at `/app/data`** to keep this data across redeploys/restarts. Without a persistent volume, these bot statistics and promo records may be lost when the container is replaced.

### Important setup
- `TELEGRAM_BOT_TOKEN` — the bot token.
- `DONUT_API_URL`, `DONUT_API_KEY`, `CASINO_OWNER_TELEGRAM_ID` — required for referral and promo rewards and balance display.
- Configure a Railway Volume mounted at `/app/data`.
- Telegram gift purchases require the bot to have sufficient Telegram Stars balance to send gifts after payment.
