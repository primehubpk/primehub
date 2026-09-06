begin;

create table if not exists public.products (
  id text primary key,
  title text,
  name text,
  description text,
  category_id text,
  category text,
  price numeric(14,2),
  original_price numeric(14,2),
  stock numeric(14,2),
  active boolean not null default true,
  image_url text,
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  variant_matrix jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  firebase_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists products_active_idx on public.products(active);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_updated_at_idx on public.products(updated_at desc);

create table if not exists public.categories (
  id text primary key,
  name text,
  slug text,
  image_url text,
  icon_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create unique index if not exists categories_slug_uq on public.categories(slug) where slug is not null and slug <> '';
create index if not exists categories_active_sort_idx on public.categories(active, sort_order);

create table if not exists public.settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);

create table if not exists public.prime_skills (
  id text primary key,
  title text,
  description text,
  price numeric(14,2),
  image_url text,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists prime_skills_active_idx on public.prime_skills(active);

create table if not exists public.orders (
  id text primary key,
  idempotency_key text,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  raw_subtotal numeric(14,2),
  subtotal numeric(14,2),
  delivery_charge numeric(14,2),
  total numeric(14,2),
  currency text not null default 'PKR',
  status text not null default 'pending',
  source text,
  fulfillment text,
  reseller_user_id text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  firebase_mirrored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create unique index if not exists orders_idempotency_uq on public.orders(idempotency_key) where idempotency_key is not null and idempotency_key <> '';
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_reseller_idx on public.orders(reseller_user_id, created_at desc);

create table if not exists public.reviews (
  id text primary key,
  product_id text not null,
  order_id text not null,
  name text,
  rating integer,
  comment text,
  image_url text,
  photos jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  source text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0,
  constraint reviews_rating_check check (rating is null or (rating between 1 and 5))
);
create unique index if not exists reviews_order_product_uq on public.reviews(order_id, product_id);
create index if not exists reviews_product_verified_idx on public.reviews(product_id, verified, created_at desc);

create table if not exists public.reward_gifts (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);

create table if not exists public.user_rewards (
  id text primary key,
  user_id text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists user_rewards_user_idx on public.user_rewards(user_id);

create table if not exists public.reward_redemptions (
  id text primary key,
  idempotency_key text,
  user_id text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create unique index if not exists reward_redemptions_idempotency_uq on public.reward_redemptions(idempotency_key) where idempotency_key is not null and idempotency_key <> '';
create index if not exists reward_redemptions_user_idx on public.reward_redemptions(user_id, created_at desc);

create table if not exists public.reseller_profiles (
  user_id text primary key,
  email text,
  status text,
  tier_id text,
  monthly_orders integer not null default 0,
  wallet_available numeric(14,2) not null default 0,
  wallet_pending numeric(14,2) not null default 0,
  points_balance integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists reseller_profiles_status_idx on public.reseller_profiles(status);

create table if not exists public.reseller_withdrawals (
  id text primary key,
  idempotency_key text,
  user_id text not null,
  amount numeric(14,2) not null default 0,
  method text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create unique index if not exists reseller_withdrawals_idempotency_uq on public.reseller_withdrawals(idempotency_key) where idempotency_key is not null and idempotency_key <> '';
create index if not exists reseller_withdrawals_user_status_idx on public.reseller_withdrawals(user_id, status, created_at desc);

create table if not exists public.reseller_reward_ledger (
  id text primary key,
  user_id text not null,
  order_id text,
  reward_amount numeric(14,2) not null default 0,
  status text,
  available_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists reseller_reward_user_status_idx on public.reseller_reward_ledger(user_id, status, available_at);
create unique index if not exists reseller_reward_order_uq on public.reseller_reward_ledger(order_id) where order_id is not null and order_id <> '';

create table if not exists public.reseller_task_claims (
  id text primary key,
  user_id text not null,
  task_id text not null,
  proof text,
  status text,
  points integer,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists reseller_task_claims_user_idx on public.reseller_task_claims(user_id, status, created_at desc);

create table if not exists public.reseller_point_ledger (
  id text primary key,
  user_id text not null,
  claim_id text,
  task_id text,
  points integer not null default 0,
  reason text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists reseller_point_user_idx on public.reseller_point_ledger(user_id, created_at desc);

create table if not exists public.reseller_task_events (
  id text primary key,
  user_id text not null,
  task_id text,
  event text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists reseller_task_events_user_idx on public.reseller_task_events(user_id, created_at desc);

create table if not exists public.reseller_whatsapp_orders (
  id text primary key,
  idempotency_key text,
  reseller_user_id text not null,
  reseller_code text,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2),
  delivery_charge numeric(14,2),
  total numeric(14,2),
  status text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create unique index if not exists reseller_wa_order_idempotency_uq on public.reseller_whatsapp_orders(idempotency_key) where idempotency_key is not null and idempotency_key <> '';
create index if not exists reseller_wa_order_user_idx on public.reseller_whatsapp_orders(reseller_user_id, status, created_at desc);

create table if not exists public.salaar_conversations (
  session_id text primary key,
  status text not null default 'AUTO',
  hold_type text,
  soft_hold_until timestamptz,
  need_you boolean not null default false,
  order_stage text,
  advance_required numeric(14,2),
  cart_summary jsonb,
  pending_customer_message text,
  pending_shown_product_ids jsonb not null default '[]'::jsonb,
  pending_message_doc_id text,
  last_message text,
  last_role text,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists salaar_status_updated_idx on public.salaar_conversations(status, updated_at desc);
create index if not exists salaar_need_you_idx on public.salaar_conversations(need_you, updated_at desc);

create table if not exists public.salaar_messages (
  id text primary key,
  session_id text not null,
  role text not null,
  text text,
  pending boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  authoritative_source text not null default 'supabase',
  mirror_status text not null default 'pending',
  mirror_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_version bigint not null default 0
);
create index if not exists salaar_messages_session_created_idx on public.salaar_messages(session_id, created_at);

create table if not exists public.dual_sync_outbox (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  target text not null default 'firebase',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists dual_sync_outbox_pending_idx on public.dual_sync_outbox(status, next_attempt_at, id);
create index if not exists dual_sync_outbox_entity_idx on public.dual_sync_outbox(entity_type, entity_id, id desc);

create table if not exists public.migration_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.settings enable row level security;
alter table public.prime_skills enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.reward_gifts enable row level security;
alter table public.user_rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.reseller_profiles enable row level security;
alter table public.reseller_withdrawals enable row level security;
alter table public.reseller_reward_ledger enable row level security;
alter table public.reseller_task_claims enable row level security;
alter table public.reseller_point_ledger enable row level security;
alter table public.reseller_task_events enable row level security;
alter table public.reseller_whatsapp_orders enable row level security;
alter table public.salaar_conversations enable row level security;
alter table public.salaar_messages enable row level security;
alter table public.dual_sync_outbox enable row level security;
alter table public.migration_state enable row level security;

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select to anon, authenticated using (active = true);
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select to anon, authenticated using (active = true);
drop policy if exists "public read active prime skills" on public.prime_skills;
create policy "public read active prime skills" on public.prime_skills for select to anon, authenticated using (active = true);
drop policy if exists "public read verified reviews" on public.reviews;
create policy "public read verified reviews" on public.reviews for select to anon, authenticated using (verified = true);

commit;
