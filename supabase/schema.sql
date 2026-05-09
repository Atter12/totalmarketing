-- Ejecuta este script en Supabase → SQL Editor (es idempotente).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text,
  apellido text,
  country text,
  whatsapp text,
  email text,
  anuncios text,
  ecommerce text,
  presupuesto text,
  compromiso boolean,
  calificado boolean not null default false,
  puntos smallint not null default 0
);

-- Columnas nuevas para guardar leads parciales (con upsert por sesión).
alter table public.leads add column if not exists session_id text unique;
alter table public.leads add column if not exists status text not null default 'incompleto';
alter table public.leads add column if not exists last_step smallint;
alter table public.leads add column if not exists updated_at timestamptz not null default now();

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

-- Eventos (para contar clics en CTAs y otras métricas).
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  session_id text,
  meta jsonb
);

create index if not exists events_type_idx on public.events (type);
create index if not exists events_created_at_idx on public.events (created_at desc);

-- Nota: la API serverless usa DATABASE_URL / DIRECT_URL.
-- Si activas RLS en Supabase, añade políticas o INSERT/UPDATE fallarán.
