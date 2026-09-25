-- PrimeHubMall daily unique visitor analytics.
-- Deliberately isolated from catalog/settings/order tables.

create table if not exists public.daily_unique_visitors (
  visit_day date not null,
  device_hash text not null,
  source text not null default 'direct',
  country text not null default 'unknown',
  first_seen_at timestamptz not null default now(),

  primary key (visit_day, device_hash),

  constraint daily_unique_visitors_source_check
    check (
      source in (
        'direct',
        'google',
        'tiktok',
        'facebook',
        'instagram',
        'whatsapp',
        'youtube',
        'other'
      )
    )
);

create index if not exists
  daily_unique_visitors_day_source_idx
on public.daily_unique_visitors (visit_day, source);

alter table public.daily_unique_visitors
  enable row level security;

revoke all
on table public.daily_unique_visitors
from public, anon, authenticated;

grant all
on table public.daily_unique_visitors
to service_role;

create or replace view
  public.daily_unique_visitor_stats
with (security_invoker = true)
as
select
  visit_day,
  source,
  count(*)::bigint as unique_devices
from public.daily_unique_visitors
group by visit_day, source;

revoke all
on table public.daily_unique_visitor_stats
from public, anon, authenticated;

grant select
on table public.daily_unique_visitor_stats
to service_role;
