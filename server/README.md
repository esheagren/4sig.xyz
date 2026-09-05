# Local API server

`server.ts` mounts the production Vercel handlers from `api/` in Express. This keeps local and hosted authentication, question selection, and scoring identical. Run `npm run dev` from the repository root with `DATABASE_URL` configured in `.env`.

See the root README for schema, migrations, tests, and deployment instructions.
