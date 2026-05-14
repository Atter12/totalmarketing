-- =============================================================================
-- Limpieza antes de clientes reales · Supabase → SQL Editor → Run
-- No hay vuelta atrás: exporta antes si necesitas las pruebas.
-- =============================================================================

-- Vacía clics/métricas del sitio y todos los registros del formulario.
truncate table public.events;
truncate table public.leads;

-- --- Alternativas (usa una u otra, no junto con lo de arriba) ---

-- Solo borrar leads con correos de prueba (edita la lista):
-- delete from public.leads
-- where lower(trim(email)) in ('tuemail@gmail.com', 'test@test.com');

-- Solo borrar formularios sin terminar:
-- delete from public.leads where status = 'incompleto';

-- Comprobar que quedó en cero:
-- select (select count(*) from public.leads) as leads,
--        (select count(*) from public.events) as eventos;
