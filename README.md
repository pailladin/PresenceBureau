# Presence Equipe - Node.js

## Prerequis
- Node.js 20+
- npm 10+

## Installation
1. Copier `.env.example` vers `.env`.
2. Ajuster `ROOM_CAPACITY` (exemple: `11`).
3. Installer les dependances:
   - `npm install`
4. Lancer en local:
   - `npm run dev`
5. Ouvrir `http://localhost:3000`.

## Variables d'environnement
- `PORT`: port local du serveur (defaut `3000`)
- `ROOM_CAPACITY`: nombre max de places (defaut `11`)
- `SUPABASE_URL`: URL du projet Supabase
- `SUPABASE_ANON_KEY`: cle publique Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: cle serveur Supabase (recommandee pour l'API backend)
- `HTTPS_PROXY`: proxy HTTP(S) entreprise (optionnel)
- `HTTP_PROXY`: proxy HTTP entreprise (optionnel)
- `NODE_EXTRA_CA_CERTS`: chemin certificat racine entreprise `.pem` (optionnel)

## Setup Supabase
1. Ouvrir SQL Editor dans Supabase.
2. Executer le script:
   - `supabase/migrations/001_presence_state.sql`
   - `supabase/migrations/002_presence_members_days.sql`
   - `supabase/migrations/003_presence_custom_statuses.sql`
   - `supabase/migrations/004_presence_day_locations.sql`
3. Verifier que les tables `public.presence_members`, `public.presence_days` et `public.presence_custom_statuses` existent.
4. Renseigner `.env` avec:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## API dispo
- `GET /api/health`
- `GET /api/config`
- `GET /api/state`
- `PUT /api/state`

## Deploiement Vercel
1. Installer Vercel CLI: `npm i -g vercel`
2. Connecter le projet: `vercel`
3. Ajouter les variables dans Vercel:
   - `ROOM_CAPACITY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HTTPS_PROXY` (si necessaire)
   - `HTTP_PROXY` (si necessaire)
   - `NODE_EXTRA_CA_CERTS` (si necessaire)
4. Deploy prod: `vercel --prod`

## Reseau entreprise (proxy/certificat)
Si `/api/state` retourne `fetch failed`, ajoute dans `.env`:
- `HTTPS_PROXY=http://proxy:port`
- `HTTP_PROXY=http://proxy:port`
- `NODE_EXTRA_CA_CERTS=C:\\chemin\\cert-entreprise.pem`

Puis redemarre `npm run dev`.
