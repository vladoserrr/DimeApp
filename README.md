# StarsApp

## Telegram bot

The service registers its Telegram webhook on startup using `TELEGRAM_BOT_TOKEN` and `RAILWAY_PUBLIC_DOMAIN` (or `TELEGRAM_WEBHOOK_URL`).

### Main menu
`/start` shows inline buttons: **Заработать**, **Канал**, **Купить подарок**, **Профиль**, **Купить премиум**, **Купить NFT**. The channel opens https://t.me/+cB3iJtgVuoBjZjBi. NFT currently shows that the section is unavailable.

### Internal Stars Stars
All shop prices are charged from the user's internal Stars balance (the same balance shown in the profile and credited for referrals/promos), not through a Telegram Stars invoice. The transfer is made from the buyer's Donut balance to the casino owner account. A failed delivery triggers a compensating refund transfer.

### Gift shop
The shop loads current gifts from Telegram `getAvailableGifts`, sorts them by ascending Telegram Stars reference price and displays six gifts per page. The user selects and confirms a gift; the corresponding amount is deducted in internal Stars Stars. The bot then sends the Telegram gift using `sendGift`. The bot must have sufficient Telegram Stars available to fulfill gift delivery.

### Telegram Premium
The menu offers:
- 3 months — 1000 internal Stars Stars.
- 6 months — 1500 internal Stars Stars.

After internal Stars Stars are charged, the bot calls Telegram `giftPremiumSubscription` to gift Premium to the buyer. Telegram's bot account must have sufficient Stars for this API operation. On API failure, the internal Stars Stars debit is refunded.

### Profile and promo codes
The profile displays the user's Stars balance, invited users, total reward stars and completed gift purchases. Promo codes can be redeemed from the profile. The owner (Telegram ID in `CASINO_OWNER_TELEGRAM_ID`) creates codes with:
`/createpromo CODE AMOUNT LIMIT`
Use `LIMIT=0` for unlimited activations. The reward is credited to the user's Stars balance through the Donut API.

### Persistent data
Referral counts, promo redemptions, gift purchase counts and pending orders are stored in `/app/data/telegram-store.json` by default. Attach a Railway Volume mounted at `/app/data` to keep this data across redeploys/restarts.

### Required configuration
- `TELEGRAM_BOT_TOKEN`
- `DONUT_API_URL`, `DONUT_API_KEY`, `CASINO_OWNER_TELEGRAM_ID`
- Railway Volume mounted at `/app/data`


### Owner notifications and admin panel
After a gift or Premium order is successfully delivered, the bot sends a private notification to the configured owner chat (`CASINO_OWNER_TELEGRAM_ID`) with the buyer's name, username, Telegram ID, purchased item and Stars amount.

The private admin command is `/admin2005`. Access requires BOTH Telegram username `@vladubrat7` and the matching numeric `CASINO_OWNER_TELEGRAM_ID`. The panel supports user balance debit/credit, broadcast to registered bot users, promo creation, and user block/unblock. Balance actions and block/unblock accept a numeric Telegram ID or a username previously seen by the bot. Broadcast skips blocked accounts.

Admin input formats:
- Debit/credit: `@username 250` or `123456789 250`.
- Promo: `CODE AMOUNT LIMIT` (limit 0 means unlimited).
- Block/unblock: `@username` or numeric Telegram ID.

A Railway Volume mounted at `/app/data` is required to retain the user directory, promo codes, referral data, blocked list and admin state.


### Order fulfillment workflow
Gift and Premium purchases are charged immediately in internal Stars Stars and recorded as `paid_pending_delivery`. The buyer receives an acceptance message naming the selected gift or Premium term and explaining that normal fulfillment takes up to 48 hours. No automatic Telegram gift/Premium delivery is attempted: the owner fulfills the order manually.

The owner receives an order notification with buyer identity, item and amount, plus an **Отправил** inline button. Pressing it marks the order as sent and sends the buyer a Telegram confirmation naming the purchased item. The button is restricted to the configured owner account.
