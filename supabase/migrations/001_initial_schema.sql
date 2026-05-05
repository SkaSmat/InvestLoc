-- ============================================================
-- ImmoAgent — Schéma initial
-- ============================================================

-- ─── search_profiles ──────────────────────────────────────────────────────────

create table if not exists public.search_profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  zones         text[]   not null default array['75','77','78','91','92','93','94','95'],
  budget_max    integer  not null default 200000,
  rendement_min_brut numeric(5,2) not null default 7.0,
  type_bien     text     not null default 'appartement'
                check (type_bien in ('appartement','maison','tous')),
  surface_min   integer  not null default 15,
  surface_max   integer  not null default 60,
  created_at    timestamptz not null default now()
);

alter table public.search_profiles enable row level security;

create policy "Users manage own search profiles"
  on public.search_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── financial_settings ───────────────────────────────────────────────────────

create table if not exists public.financial_settings (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade,
  taux_credit         numeric(5,2) not null default 3.3,
  taux_assurance      numeric(5,3) not null default 0.1,
  duree               integer      not null default 25,
  frais_notaires_pct  numeric(5,2) not null default 7.5,
  tmi                 integer      not null default 30,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

alter table public.financial_settings enable row level security;

create policy "Users manage own financial settings"
  on public.financial_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── listings ────────────────────────────────────────────────────────────────

create table if not exists public.listings (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete set null,
  url           text        not null,
  title         text,
  price         integer,
  surface       numeric(6,1),
  rooms         integer,
  address       text,
  postal_code   char(5),
  city          text,
  condition     text check (condition in ('neuf','bon','moyen','travaux')),
  published_at  date,
  description   text,
  dvf_mediane   integer,
  dvf_ecart_pct numeric(6,2),
  created_at    timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "Users manage own listings"
  on public.listings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── opportunities ────────────────────────────────────────────────────────────

create table if not exists public.opportunities (
  id                  uuid primary key default uuid_generate_v4(),
  listing_url         text         not null,
  title               text,
  price               integer,
  surface             numeric(6,1),
  city                text,
  postal_code         char(5),
  rendement_brut      numeric(5,2),
  score_total         integer,
  score_dvf           integer,
  score_rentabilite   integer,
  score_quartier      integer,
  score_nego          integer,
  dvf_ecart_pct       numeric(6,2),
  published_at        date,
  created_at          timestamptz not null default now()
);

alter table public.opportunities enable row level security;

-- Lecture publique (pour l'agent autonome qui push sans user connecté)
create policy "Service role full access on opportunities"
  on public.opportunities for all
  using (true)
  with check (true);
