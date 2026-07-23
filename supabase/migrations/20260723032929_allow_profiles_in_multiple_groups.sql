create table if not exists public.profile_group_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.profile_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, group_id)
);

create index if not exists profile_group_memberships_group_id_idx
  on public.profile_group_memberships(group_id);

alter table public.profile_group_memberships enable row level security;

drop policy if exists acesso_publico_profile_group_memberships
  on public.profile_group_memberships;

create policy acesso_publico_profile_group_memberships
  on public.profile_group_memberships
  for all
  to public
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.profile_group_memberships
  to anon, authenticated;

insert into public.profile_group_memberships (profile_id, group_id)
select id, group_id
from public.profiles
where group_id is not null
on conflict (profile_id, group_id) do nothing;
