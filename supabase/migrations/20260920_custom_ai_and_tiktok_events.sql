alter table public.salar_provider_secrets
  drop constraint if exists salar_provider_secrets_provider_check;

alter table public.salar_provider_secrets
  add constraint salar_provider_secrets_provider_check
  check (provider in ('cloudflare', 'groq', 'gemini', 'openrouter', 'custom'));

create table if not exists public.integration_secrets (
  integration text primary key,
  envelope text not null,
  updated_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.integration_secrets to service_role;
