# StreamerCinematicUniverse

SCU is a responsive event and live-stream discovery hub for creator culture, built with Next.js, React, TypeScript, Twitch Helix, and official Twitch embeds.

**Live site:** https://streamer-cinematic-universe.vercel.app

> This app cannot run on GitHub Pages. Pages only hosts static files; SCU needs a Node server for API routes, auth, and Twitch. Host it on **Vercel** (already configured). In the GitHub repo, turn Pages off under Settings → Pages if it is still enabled.

## Run locally

```bash
npm install
# Configure Twitch first; see docs/TWITCH_SETUP.md
npm run dev
```

Open `http://localhost:3000`.

## Included experiences

- Editorial home, discovery, event board and event detail pages
- Category and unified streamer profiles
- Adaptive six-stream Twitch watchspace with drag reorder, resizable smart layouts, switchable chat, per-player controls, and hidden-tab pausing
- Dashboard, calendar, saved items, provider connections, settings, and onboarding
- Night, light, and OLED themes with accessibility preferences
- Responsive desktop, tablet, and mobile navigation
- Server-only Twitch Helix client, encrypted OAuth session, followed streams, channel search, and rate-limit-aware API routes
- Curated SCU events kept in code (`lib/data.ts`); accounts/profiles/follows use Supabase

## Routes

`/`, `/discover`, `/events`, `/events/streamer-university`, `/categories/gaming`, `/streamers/kai`, `/multistream`, `/search`, `/dashboard`, `/dashboard/calendar`, `/dashboard/saved`, `/dashboard/connections`, `/settings`, `/login`

## Provider integration

Follow `docs/TWITCH_SETUP.md` to rotate credentials, create `.env.local`, and register exact local and production callback URLs. Secrets and tokens remain server-only; browser players and chat receive only channel names and the required parent hostname.

Twitch is the active live provider. YouTube remains isolated behind `components/features/player/provider.ts` for a later integration. SCU accounts use Supabase Auth (email/password + Google); events stay in local code. Twitch OAuth is a linked connection for followed live channels. See `docs/SUPABASE_SETUP.md` and `docs/TWITCH_SETUP.md`.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
