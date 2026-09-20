create table if not exists public.salar_provider_secrets (
  provider text primary key check (provider in ('cloudflare', 'groq', 'gemini', 'openrouter')),
  envelope text not null,
  updated_at timestamptz not null default now()
);
alter table public.salar_provider_secrets enable row level security;
revoke all on public.salar_provider_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.salar_provider_secrets to service_role;
