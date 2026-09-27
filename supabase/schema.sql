-- Supabase SQL Editor에서 한 번 실행합니다. 재실행해도 기존 자료는 유지됩니다.
create table if not exists public.teacher_workspace (
  id text primary key check (id = 'main'),
  payload jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.teacher_workspace enable row level security;
revoke all on public.teacher_workspace from anon, authenticated;
grant select, update on public.teacher_workspace to service_role;
grant usage on schema public to service_role;
insert into public.teacher_workspace(id) values ('main') on conflict (id) do nothing;
notify pgrst, 'reload schema';
