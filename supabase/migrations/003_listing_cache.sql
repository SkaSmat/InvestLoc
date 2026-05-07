-- ─── Cache des annonces extraites ─────────────────────────────────────────────
-- Évite de re-scraper la même URL dans les 7 jours

create table if not exists public.listing_cache (
  id          uuid primary key default gen_random_uuid(),
  url         text not null unique,
  data        jsonb not null,
  scraped_at  timestamptz not null default now()
);

-- Index pour accélérer la recherche par URL
create index if not exists listing_cache_url_idx on public.listing_cache (url);

-- Accès anonyme en lecture/écriture (pas de données sensibles, les annonces sont publiques)
alter table public.listing_cache enable row level security;

create policy "Anon read cache"
  on public.listing_cache for select
  using (true);

create policy "Anon write cache"
  on public.listing_cache for insert
  with check (true);

create policy "Anon update cache"
  on public.listing_cache for update
  using (true);

-- Nettoyage automatique des entrées > 7 jours (via pg_cron si disponible)
-- Sinon, la Edge Function gère le TTL côté applicatif
