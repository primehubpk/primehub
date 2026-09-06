begin;
create table if not exists public.auth_identity_map (
  firebase_uid text primary key,
  email text,
  display_name text,
  email_verified boolean not null default false,
  provider_ids jsonb not null default '[]'::jsonb,
  supabase_user_id uuid,
  auth_source text not null default 'firebase',
  migration_status text not null default 'firebase_active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists auth_identity_map_email_uq on public.auth_identity_map(lower(email)) where email is not null and email <> '';
create index if not exists auth_identity_map_status_idx on public.auth_identity_map(migration_status, updated_at desc);
alter table public.auth_identity_map enable row level security;
commit;
