-- Sauvegarde en ligne de la progression (à coller dans Supabase : SQL Editor, puis Run).
-- Une ligne de progression par compte. Chaque compte lit et écrit sa propre ligne ;
-- un compte parent peut en plus lire (sans la modifier) celle des élèves qu'il suit.

create table if not exists public.progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Qui suit qui : rempli à la main (voir en bas), jamais depuis la page.
create table if not exists public.followers (
  student_id uuid not null references auth.users (id) on delete cascade,
  follower_id uuid not null references auth.users (id) on delete cascade,
  student_name text not null,
  primary key (student_id, follower_id)
);

alter table public.progress enable row level security;
alter table public.followers enable row level security;

revoke all on public.progress from anon, authenticated;
revoke all on public.followers from anon, authenticated;
grant select, insert, update on public.progress to authenticated;
grant select on public.followers to authenticated;

drop policy if exists "Voir qui on suit" on public.followers;
create policy "Voir qui on suit" on public.followers
  for select to authenticated using ((select auth.uid()) = follower_id);

drop policy if exists "Lire sa progression" on public.progress;
create policy "Lire sa progression" on public.progress
  for select to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.followers f where f.student_id = progress.user_id and f.follower_id = (select auth.uid()))
  );

drop policy if exists "Créer sa progression" on public.progress;
create policy "Créer sa progression" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Modifier sa progression" on public.progress;
create policy "Modifier sa progression" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Une fois les deux comptes créés (Authentication, Users), rattacher l'élève au parent
-- en remplaçant les deux emails et le prénom, puis Run :
--
-- insert into public.followers (student_id, follower_id, student_name)
-- select s.id, p.id, 'Prénom'
-- from auth.users s, auth.users p
-- where s.email = 'email-de-l-eleve@exemple.fr' and p.email = 'email-du-parent@exemple.fr';
