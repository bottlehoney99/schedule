create table if not exists public.schedules (
  id text primary key,
  category text not null check (category in ('homeroom', 'department', 'subject')),
  title text not null,
  date date not null,
  start_time text not null default '',
  end_time text not null default '',
  place text not null default '',
  memo text not null default '',
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedules
add column if not exists reminder_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedules_reminder_minutes_check'
  ) then
    alter table public.schedules
    add constraint schedules_reminder_minutes_check
    check (reminder_minutes is null or reminder_minutes >= 0);
  end if;
end $$;

alter table public.schedules enable row level security;

drop policy if exists "Public read schedules" on public.schedules;
drop policy if exists "Public insert schedules" on public.schedules;
drop policy if exists "Public update schedules" on public.schedules;
drop policy if exists "Public delete schedules" on public.schedules;

create policy "Public read schedules"
on public.schedules
for select
to anon
using (true);

create policy "Public insert schedules"
on public.schedules
for insert
to anon
with check (true);

create policy "Public update schedules"
on public.schedules
for update
to anon
using (true)
with check (true);

create policy "Public delete schedules"
on public.schedules
for delete
to anon
using (true);

create index if not exists schedules_date_idx on public.schedules (date);
create index if not exists schedules_category_idx on public.schedules (category);
create index if not exists schedules_completed_idx on public.schedules (completed);
