# Supabase setup (SCU)

SCU uses the **Parcel DataBase** Supabase project for accounts, profiles, follows, Twitch linking, saved events/watchspaces, notifications, and curated `scu_events`. Static `lib/data.ts` remains a fallback seed source for events when the DB is empty or unreachable.

## Environment

Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jyheogfcdtrhugthvups.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Optional, server-only:
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM=SCU <onboarding@resend.dev>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
TWITCH_EVENTSUB_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Legacy aliases also work: `SUPABASE_PUBLIC_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Never commit real keys. Keep secrets out of `.env.example`.

### Ops checklist

| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` / `EMAIL_FROM` | Opt-in email (only when `email_notifications` is on) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Browser Web Push |
| `CRON_SECRET` | Protects cron routes: `GET /api/cron/event-reminders` (every 15m) and `GET /api/cron/twitch-rivals-sync` (every 3h) |
| `TWITCH_EVENTSUB_SECRET` | Verifies `stream.online` webhooks at `/api/twitch/eventsub` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for links / redirects |

Confirm your profile `role` is `admin` or `owner` to use `/admin/events`.

## Auth providers

1. In the [Supabase dashboard](https://supabase.com/dashboard/project/jyheogfcdtrhugthvups/auth/providers), enable **Email** (password).
2. Enable **Google** for “Continue with Google” / Chrome sign-in.
3. Google Cloud OAuth client: authorized redirect URI  
   `https://jyheogfcdtrhugthvups.supabase.co/auth/v1/callback`
4. Supabase Auth URL config:
   - Site URL: `http://localhost:3000` (and your production origin later)
   - Redirect allow list: `http://localhost:3000/auth/callback`

## App routes

| Route | Purpose |
|-------|---------|
| `/login` | Email/password + Google |
| `/signup` | Create account |
| `/onboarding` | Username (required), password optional for Google users, avatar optional |
| `/logout` | Sign out |
| `/auth/callback` | OAuth code exchange |
| `/dashboard/connections` | Link Twitch (requires SCU session) |
| `/help` | SCU help articles + support tickets |
| `/admin/events` | Events CMS (admin/owner) |

## Schema (additive on Parcel)

**Profiles (SCU prefs columns):** `event_reminders`, `live_alerts`, `email_notifications`, `push_notifications`, `prefer_captions`, `personalization` (plus existing Parcel fields: `bio`, `onboarding_completed`, `role`, language prefs).

**SCU tables (RLS user-owned unless noted):**

| Table | Purpose |
|-------|---------|
| `follows` | SCU users following Twitch creators |
| `linked_accounts` | Twitch provider link per user |
| `scu_saved_events` | Saved event slugs + remind flag |
| `scu_watchspaces` | Multistream layouts (`payload` jsonb) |
| `scu_push_subscriptions` | Web Push endpoints |
| `scu_watch_stats` | Minutes watched |
| `scu_notification_log` | Dedupe keys for fan-out |
| `scu_events` | Curated events CMS (public read of published; admin write) |
| `notifications` | Shared Parcel in-app feed (`type` like `scu_live`, `scu_event_reminder`) |
| `knowledge_articles` | Help content (`category = 'scu'`) |
| `support_tickets` / `ticket_messages` | Help contact form |

Storage bucket `avatars` — public read, user-scoped write.

Seed events: `/admin/events` → **Seed from code**, or `GET /api/events?seed=1&force=1` as admin.

## Twitch

Twitch remains a **linked** provider (encrypted cookie + Helix), not primary login. Connect from Connections after signing into SCU.

For go-live alerts, subscribe Twitch EventSub `stream.online` to your deployed `/api/twitch/eventsub` URL and set `TWITCH_EVENTSUB_SECRET`.
