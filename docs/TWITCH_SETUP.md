# Twitch setup for SCU

SCU uses Twitch Helix on the server, Twitch Authorization Code OAuth for account linking, and official Twitch video/chat embeds in the browser.

## 1. Rotate any exposed secret

If a client secret was pasted into chat, source code, an issue, or a screenshot, treat it as compromised:

1. Open the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Open **SCU - Streamer Cinematic Universe**.
3. Generate a new client secret and revoke the previous one.
4. Do not paste the replacement into chat or commit it.

The Client ID identifies the application and is not a password. The Client Secret is a password and must remain server-only.

## 2. Configure the Twitch application

In the Twitch Developer Console, add these exact OAuth Redirect URLs:

```text
http://localhost:3000/api/auth/callback/twitch
https://YOUR_PRODUCTION_DOMAIN/api/auth/callback/twitch
```

(The legacy path `/api/auth/twitch/callback` is also supported by the app if already registered.)

Replace `YOUR_PRODUCTION_DOMAIN` with the real hostname before deployment. Twitch requires the callback sent during OAuth to exactly match a registered URL.

Choose **Website Integration** as the application category and save.

## 3. Configure localhost

Copy `.env.example` to `.env.local` and fill in the values:

```dotenv
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_new_rotated_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/callback/twitch
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=a_long_random_value
```

Generate `SESSION_SECRET` with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Restart `npm run dev` after changing environment variables. `.env.local` is ignored by Git.

## 4. Test locally

1. Open `http://localhost:3000`.
2. Confirm Discover and Multistream show Twitch data.
3. Open Dashboard → Connections and connect Twitch.
4. Approve the minimal `user:read:follows` permission.
5. Confirm followed live channels appear.
6. Add channels to Multistream and verify video and chat.

Browser autoplay rules may require the first stream to start muted or require a click. Twitch embeds require a usable visible player area.

## 5. Configure production

Set these environment variables in the deployment provider:

```dotenv
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_rotated_secret
TWITCH_REDIRECT_URI=https://YOUR_PRODUCTION_DOMAIN/api/auth/callback/twitch
NEXT_PUBLIC_APP_URL=https://YOUR_PRODUCTION_DOMAIN
SESSION_SECRET=a_unique_production_random_value
```

Before deploying:

- add the exact HTTPS callback URL in the Twitch Developer Console;
- use a production `SESSION_SECRET` different from local development;
- confirm video and chat embed URLs receive the production hostname as `parent`;
- never expose `TWITCH_CLIENT_SECRET`, app access tokens, user access tokens, or refresh tokens in client code;
- rotate credentials immediately if they are exposed.
