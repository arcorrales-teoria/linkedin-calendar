-- Tabla de publicaciones del calendario LinkedIn — ejecutar una vez en el SQL Editor de Supabase
-- (https://supabase.com/dashboard → proyecto kbtbqsglagdurlqtlnww → SQL Editor)

create table if not exists public.publications (
  id          text primary key,
  title       text not null default '',
  content     text not null default '',
  start_date  date not null,
  end_date    date not null,
  country     text not null default 'CO',
  category    text,
  people      jsonb not null default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Si la tabla se creó antes de añadir estas columnas, ejecutar también estos ALTER
-- (idempotentes: no tocan datos existentes). Sin la columna 'category' los POST fallan
-- con "Could not find the 'category' column" y los posts no se guardan.
alter table public.publications add column if not exists category text;
alter table public.publications add column if not exists created_at timestamptz default now();
alter table public.publications add column if not exists updated_at timestamptz default now();

-- Índice para ordenar por fecha (el GET usa .order("start_date", ascending: true))
create index if not exists idx_publications_start_date on public.publications(start_date);

-- Solo el service role lee/escribe (la app usa SUPABASE_SERVICE_ROLE_KEY)
alter table public.publications enable row level security;
