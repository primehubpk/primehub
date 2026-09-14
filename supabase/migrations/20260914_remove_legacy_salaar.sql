begin;

-- Remove database objects owned only by the retired Salaar salesman implementation.
-- The replacement Salar system will define its own schema from scratch when built.
drop table if exists public.salaar_messages cascade;
drop table if exists public.salaar_conversations cascade;

commit;
