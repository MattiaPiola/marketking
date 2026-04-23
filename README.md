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
# Run the SQL in supabase/migrations/001_initial_schema.sql via the Supabase SQL editor
# or using the Supabase CLI:
#   supabase db push

# 4. Start the development server
npm run dev
```

### Deployment (Netlify)

Connect your repository to Netlify. The `netlify.toml` configures:
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirects: all routes → `index.html`

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Netlify.

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
| 7 | Shock system |
| 8 | Expandable catalog & complexity levels |
| 9 | Admin analytics, parameter tuning & game end |
| 10 | Polish, persistence & post-MVP features |

