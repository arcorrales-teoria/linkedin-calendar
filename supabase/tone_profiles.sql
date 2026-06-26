-- Tabla de perfiles de tono — ejecutar una vez en el SQL Editor de Supabase
-- (https://supabase.com/dashboard → proyecto kbtbqsglagdurlqtlnww → SQL Editor)

create table if not exists public.tone_profiles (
  person_name        text primary key,
  linkedin_url       text default '',
  email              text default '',
  sample_text        text not null,
  writing_style      text default 'profesional',
  uses_emojis        boolean default false,
  uses_hashtags      boolean default false,
  uses_questions     boolean default false,
  uses_lists         boolean default false,
  avg_words_per_post integer,
  updated_at         timestamptz default now()
);

-- Si la tabla ya existía, agrega la columna de correo (idempotente).
-- El correo se usa para invitar a la persona a los recordatorios 9am/4pm del calendario.
alter table public.tone_profiles add column if not exists email text default '';

-- Solo el service role escribe/lee (la app usa SUPABASE_SERVICE_ROLE_KEY)
alter table public.tone_profiles enable row level security;
