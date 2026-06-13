-- Caché de cuentas sugeridas para seguir — ejecutar una vez en el SQL Editor de Supabase
-- (https://supabase.com/dashboard → proyecto kbtbqsglagdurlqtlnww → SQL Editor)
--
-- La idea: cada perfil de Apollo se resuelve a su URL de LinkedIn UNA sola vez.
-- A partir de ahí queda cacheado aquí, así que mostrarlo de nuevo es gratis e instantáneo
-- (no vuelve a llamar a Apollo ni a Google).
--
-- Las columnas reflejan las propiedades de búsqueda que usamos al armar listas en Apollo
-- (ej. "Lista comfandi"), agrupadas por categoría: contexto de búsqueda, persona y empresa.

create table if not exists public.account_suggestions (
  apollo_id      text primary key,   -- id único de la persona en Apollo

  -- ── Contexto de búsqueda (con qué filtros se encontró) ──
  category       text,               -- producto seleccionado en la tarjeta del calendario: Digital Identity | Background Checks | WA Onboarding | WA Banking | WA Agentic
  icp_group      text,               -- grupo de ICP al que pertenece el cargo: growth | risk
  industry_tags  text[],             -- q_organization_keyword_tags usados (fintech, payments, banking, financial services)
  country        text default '',    -- país de la TARJETA del calendario (LATAM | CO | MX | PE | CL | AR); de aquí salen los person_locations

  -- ── Persona (filtros person_* de Apollo) ──
  first_name     text,
  full_name      text,               -- arranca = first_name; se completa al resolver
  title          text,               -- person_titles
  seniority      text,               -- person_seniorities: head | manager | senior | vp | c_suite
  headline       text,               -- titular de LinkedIn que devuelve Apollo

  -- ── Empresa (filtros organization_* / q_organization_* de Apollo) ──
  company        text,               -- nombre de la organización
  company_domain text,               -- dominio principal de la organización
  email_status   text,               -- verified | extrapolated | unavailable (estado del email en Apollo)

  -- ── Resolución del LinkedIn ──
  linkedin_url   text,
  resolved       boolean default false,  -- true cuando ya encontramos su LinkedIn
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Si la tabla ya existía (versión anterior sin propiedades de búsqueda),
-- estas líneas agregan las columnas nuevas sin tocar los datos cacheados:
alter table public.account_suggestions add column if not exists category       text;
alter table public.account_suggestions add column if not exists icp_group      text;
alter table public.account_suggestions add column if not exists industry_tags  text[];
alter table public.account_suggestions add column if not exists seniority      text;
alter table public.account_suggestions add column if not exists headline       text;
alter table public.account_suggestions add column if not exists company_domain text;
alter table public.account_suggestions add column if not exists email_status   text;

-- Solo el service role lee/escribe (la app usa SUPABASE_SERVICE_ROLE_KEY)
alter table public.account_suggestions enable row level security;

-- ── Rotación por publicación (sin repetir, misma lista por país+tema) ──
-- A cada publicación se le asigna un "bloque" (page) distinto dentro de su país+tema (scope).
-- Reabrir la misma publicación → mismo bloque. Nueva publicación → siguiente bloque, sin repetir.
create table if not exists public.suggestion_assignments (
  pub_key    text primary key,   -- "CO|Digital Identity|<publicationId>"
  scope      text not null,      -- "CO|Digital Identity"
  page       int  not null,
  created_at timestamptz default now()
);
create index if not exists idx_suggestion_assignments_scope on public.suggestion_assignments(scope);
alter table public.suggestion_assignments enable row level security;
