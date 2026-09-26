-- Optional signed-in member identity for daily unique visitor rows.
-- Counting remains one row per (visit_day, device_hash).

alter table if exists public.daily_unique_visitors
  add column if not exists member_uid text,
  add column if not exists member_email text,
  add column if not exists member_name text;

create index if not exists
  daily_unique_visitors_member_uid_idx
on public.daily_unique_visitors (member_uid)
where member_uid is not null;
