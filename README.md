# Evayoung Photography

A cinematic photography portfolio with booking enquiries and a private photographer workspace for client collections.

## Get started

From the repository root:

```powershell
npm.cmd run build
npm.cmd test
python -m http.server 4173 --directory dist
```

Open [http://localhost:4173](http://localhost:4173) for the public site. The Python server previews only static files; workspace API routes require Vercel Functions and the configured Supabase project.

## Project layout

- `dist/` — public website, owner workspace, and client gallery pages.
- `api/` — Vercel serverless API routes.
- `server/` — server-only authentication and Supabase helpers.
- `supabase/migrations/` — workspace database schema and access controls.
- `scripts/` — build checks and focused tests.

## Documentation

Start at the [documentation index](docs/README.md) for deployment, workspace setup, and operational notes.
