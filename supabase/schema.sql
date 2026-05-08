-- Ejecuta esto en Supabase → SQL Editor (o psql contra tu proyecto).
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

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- La API serverless usa DATABASE_URL / DIRECT_URL (rol con permisos INSERT).
-- Si activas RLS en Supabase, añade políticas o INSERT fallará.
