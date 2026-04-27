# Mercato Vivo

Gioco educativo di economia multiplayer. Studenti gestiscono un'azienda di abbigliamento in competizione diretta.

**Stack:** React + Vite (Netlify) | Supabase (PostgreSQL + Realtime + Auth + Edge Functions)

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase dashboard

# 3. Apply database migrations
# Open the Supabase SQL editor for your project and run each file in order:
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/002_turn_management.sql
#   supabase/migrations/003_turn_phase.sql
#   supabase/migrations/004_catalog_costs.sql
#   supabase/migrations/005_add_admin_id_to_rooms.sql
#
# Alternatively, if you have the Supabase CLI linked to your project:
#   supabase db push
#
# IMPORTANT: all migrations must be applied in numeric order.
# If you skip any migration (especially 005) you may see errors such as
# "Could not find the 'admin_id' column of 'rooms' in the schema cache"
# when creating a room.

# 4. Start the development server
npm run dev
```

### Deployment (Netlify)

1. **Connect the repository** – In the [Netlify dashboard](https://app.netlify.com), click **Add new site → Import an existing project** and authorise access to this GitHub repository.

2. **Build settings** – The `netlify.toml` already sets everything correctly:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - SPA redirects: all routes → `index.html`

3. **Add Supabase environment variables** – Go to **Site configuration → Environment variables** (formerly *Build & deploy → Environment*) and add:

   | Variable | Where to find it |
   |---|---|
   | `VITE_SUPABASE_URL` | [Supabase dashboard](https://supabase.com/dashboard) → select your project → **Settings → API** → **Project URL** |
   | `VITE_SUPABASE_ANON_KEY` | Same page → **Project API keys** → **anon / public** key |
   | `VITE_APP_URL` | The Netlify site URL shown in **Site overview** (e.g. `https://mercatovivo.netlify.app`) |

4. **Deploy** – Trigger a deploy (Netlify deploys automatically on every push to the default branch once connected).

---

## Project Structure

```
src/
  lib/        – Supabase client & realtime helpers
  pages/      – Route-level components
  components/ – Shared UI components
  hooks/      – Custom React hooks
supabase/
  migrations/ – SQL migration files
```

---

## Implementation Sessions

| Session | Focus |
|---------|-------|
| 1 | Project scaffold & database schema ✅ |
| 2 | Auth, room creation & lobby ✅ |
| 3 | Core demand & profit engine (Edge Functions) ✅ |
| 4 | Player decision panel & live preview ✅ |
| 5 | Admin panel: turn management & monitoring ✅ |
| 6 | Results reveal & post-turn feedback ✅ |
| 7 | Shock system ✅ |
| 8 | Expandable catalog & complexity levels ✅ |
| 9 | Admin analytics, parameter tuning & game end ✅ |
| 10 | Polish, persistence & post-MVP features ✅ |

