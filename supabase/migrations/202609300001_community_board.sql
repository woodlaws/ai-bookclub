-- AI 독서클럽 운영 게시판. 기존 데이터와 테이블을 삭제하지 않습니다.
begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '회원' check (char_length(display_name) between 1 and 40),
  membership_status text not null default 'pending' check (membership_status in ('pending','approved','revoked')),
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice','resource')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 50000),
  description text check (description is null or char_length(description) <= 10000),
  visibility text not null default 'public' check (visibility in ('public','members')),
  pinned boolean not null default false,
  book_title text check (book_title is null or char_length(book_title) <= 200),
  meeting_at timestamptz,
  resource_type text check (resource_type is null or resource_type in ('workbook','lecture','prompt','replay')),
  external_url text check (external_url is null or external_url ~ '^https?://'),
  author_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind='notice' and body is not null) or (kind='resource' and description is not null)),
  check (kind='resource' or resource_type is null)
);

create table if not exists public.reading_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('reading','practice','recommendation')),
  book_title text not null check (char_length(book_title) between 1 and 200),
  learning text not null check (char_length(learning) between 1 and 10000),
  action_plan text not null check (char_length(action_plan) between 1 and 10000),
  outcome text check (outcome is null or char_length(outcome) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_comments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.reading_records(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  public_display_name text not null check (char_length(public_display_name) between 1 and 40),
  public_consent boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  inquiry_type text not null check (inquiry_type in ('join','participation','resource','other')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'waiting' check (status in ('waiting','answered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','record','review','inquiry')),
  target_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now()
);

create index if not exists community_posts_list_idx on public.community_posts(kind, visibility, pinned desc, created_at desc);
create index if not exists reading_records_created_idx on public.reading_records(created_at desc);
create index if not exists reading_records_owner_idx on public.reading_records(owner_id);
create index if not exists record_comments_record_idx on public.record_comments(record_id, created_at);
create index if not exists community_reviews_public_idx on public.community_reviews(public_consent, approval_status, created_at desc);
create index if not exists community_reviews_owner_idx on public.community_reviews(owner_id);
create index if not exists inquiries_owner_status_idx on public.inquiries(owner_id, status, created_at desc);
create index if not exists inquiry_replies_inquiry_idx on public.inquiry_replies(inquiry_id, created_at);
create index if not exists attachments_target_idx on public.attachments(target_type, target_id);

-- 마이그레이션 전에 이미 인증된 계정도 승인 대기 프로필을 갖게 한다.
insert into public.profiles(id,display_name)
select u.id,coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),split_part(u.email,'@',1),'회원')
from auth.users u
on conflict(id) do nothing;

create or replace function private.is_admin(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles p where p.id=check_user and p.role='admin') $$;
create or replace function private.is_member(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles p where p.id=check_user and (p.membership_status='approved' or p.role='admin')) $$;

create or replace function private.can_read_target(p_type text,p_id uuid,check_user uuid default auth.uid()) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_type='post' then return exists(select 1 from public.community_posts p where p.id=p_id and (p.visibility='public' or private.is_member(check_user)));
  elsif p_type='record' then return private.is_member(check_user) and exists(select 1 from public.reading_records r where r.id=p_id);
  elsif p_type='review' then return exists(select 1 from public.community_reviews r where r.id=p_id and ((r.public_consent and r.approval_status='approved') or r.owner_id=check_user or private.is_admin(check_user)));
  elsif p_type='inquiry' then return check_user is not null and exists(select 1 from public.inquiries i where i.id=p_id and (i.owner_id=check_user or private.is_admin(check_user)));
  end if;
  return false;
end $$;

create or replace function private.can_manage_target(p_type text,p_id uuid,check_user uuid default auth.uid()) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_admin(check_user) then return true; end if;
  if p_type='record' then return private.is_member(check_user) and exists(select 1 from public.reading_records r where r.id=p_id and r.owner_id=check_user);
  elsif p_type='review' then return private.is_member(check_user) and exists(select 1 from public.community_reviews r where r.id=p_id and r.owner_id=check_user);
  elsif p_type='inquiry' then return exists(select 1 from public.inquiries i where i.id=p_id and i.owner_id=check_user);
  end if;
  return false;
end $$;

revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin(uuid),private.is_member(uuid),private.can_read_target(text,uuid,uuid),private.can_manage_target(text,uuid,uuid) to anon, authenticated;

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create or replace function private.review_reapproval() returns trigger language plpgsql set search_path='' as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body or new.public_display_name is distinct from old.public_display_name then
    new.approval_status='pending'; new.approved_by=null; new.approved_at=null;
  end if;
  if old.public_consent and not new.public_consent then new.approval_status='pending'; new.approved_by=null; new.approved_at=null; end if;
  return new;
end $$;
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'회원')) on conflict(id) do nothing;
  return new;
end $$;

create or replace function private.enforce_attachment_limit() returns trigger language plpgsql set search_path='' as $$
begin
  if (select count(*) from public.attachments a where a.target_type=new.target_type and a.target_id=new.target_id) >= 5 then
    raise exception 'A post can have at most 5 attachments' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists ai_bookclub_profile_on_signup on auth.users;
create trigger ai_bookclub_profile_on_signup after insert on auth.users for each row execute function private.handle_new_user();
drop trigger if exists community_posts_touch on public.community_posts;
create trigger community_posts_touch before update on public.community_posts for each row execute function private.touch_updated_at();
drop trigger if exists reading_records_touch on public.reading_records;
create trigger reading_records_touch before update on public.reading_records for each row execute function private.touch_updated_at();
drop trigger if exists comments_touch on public.record_comments;
create trigger comments_touch before update on public.record_comments for each row execute function private.touch_updated_at();
drop trigger if exists reviews_reapproval on public.community_reviews;
create trigger reviews_reapproval before update on public.community_reviews for each row execute function private.review_reapproval();
drop trigger if exists reviews_touch on public.community_reviews;
create trigger reviews_touch before update on public.community_reviews for each row execute function private.touch_updated_at();
drop trigger if exists inquiries_touch on public.inquiries;
create trigger inquiries_touch before update on public.inquiries for each row execute function private.touch_updated_at();
drop trigger if exists attachments_limit on public.attachments;
create trigger attachments_limit before insert on public.attachments for each row execute function private.enforce_attachment_limit();

alter table public.profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.reading_records enable row level security;
alter table public.record_comments enable row level security;
alter table public.community_reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_replies enable row level security;
alter table public.attachments enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using ((select auth.uid())=id or private.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

drop policy if exists posts_read on public.community_posts;
create policy posts_read on public.community_posts for select to anon,authenticated using (visibility='public' or private.is_member());
drop policy if exists posts_admin_insert on public.community_posts;
create policy posts_admin_insert on public.community_posts for insert to authenticated with check (private.is_admin() and author_id=(select auth.uid()));
drop policy if exists posts_admin_update on public.community_posts;
create policy posts_admin_update on public.community_posts for update to authenticated using (private.is_admin()) with check (private.is_admin() and author_id is not null);
drop policy if exists posts_admin_delete on public.community_posts;
create policy posts_admin_delete on public.community_posts for delete to authenticated using (private.is_admin());

drop policy if exists records_member_read on public.reading_records;
create policy records_member_read on public.reading_records for select to authenticated using (private.is_member());
drop policy if exists records_owner_insert on public.reading_records;
create policy records_owner_insert on public.reading_records for insert to authenticated with check (private.is_member() and owner_id=(select auth.uid()));
drop policy if exists records_owner_update on public.reading_records;
create policy records_owner_update on public.reading_records for update to authenticated using (owner_id=(select auth.uid()) or private.is_admin()) with check ((owner_id=(select auth.uid()) and private.is_member()) or private.is_admin());
drop policy if exists records_owner_delete on public.reading_records;
create policy records_owner_delete on public.reading_records for delete to authenticated using (owner_id=(select auth.uid()) or private.is_admin());

drop policy if exists comments_member_read on public.record_comments;
create policy comments_member_read on public.record_comments for select to authenticated using (private.is_member());
drop policy if exists comments_owner_insert on public.record_comments;
create policy comments_owner_insert on public.record_comments for insert to authenticated with check (private.is_member() and owner_id=(select auth.uid()));
drop policy if exists comments_owner_update on public.record_comments;
create policy comments_owner_update on public.record_comments for update to authenticated using (owner_id=(select auth.uid()) or private.is_admin()) with check ((owner_id=(select auth.uid()) and private.is_member()) or private.is_admin());
drop policy if exists comments_owner_delete on public.record_comments;
create policy comments_owner_delete on public.record_comments for delete to authenticated using (owner_id=(select auth.uid()) or private.is_admin());

drop policy if exists reviews_read on public.community_reviews;
create policy reviews_read on public.community_reviews for select to anon,authenticated using ((public_consent and approval_status='approved') or owner_id=(select auth.uid()) or private.is_admin());
drop policy if exists reviews_owner_insert on public.community_reviews;
create policy reviews_owner_insert on public.community_reviews for insert to authenticated with check (private.is_member() and owner_id=(select auth.uid()) and approval_status='pending' and approved_by is null);
drop policy if exists reviews_owner_update on public.community_reviews;
create policy reviews_owner_update on public.community_reviews for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and private.is_member());
drop policy if exists reviews_owner_delete on public.community_reviews;
create policy reviews_owner_delete on public.community_reviews for delete to authenticated using (owner_id=(select auth.uid()) or private.is_admin());

drop policy if exists inquiries_private_read on public.inquiries;
create policy inquiries_private_read on public.inquiries for select to authenticated using (owner_id=(select auth.uid()) or private.is_admin());
drop policy if exists inquiries_owner_insert on public.inquiries;
create policy inquiries_owner_insert on public.inquiries for insert to authenticated with check (owner_id=(select auth.uid()) and status='waiting');
drop policy if exists inquiries_owner_update on public.inquiries;
create policy inquiries_owner_update on public.inquiries for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists inquiries_owner_delete on public.inquiries;
create policy inquiries_owner_delete on public.inquiries for delete to authenticated using (owner_id=(select auth.uid()) or private.is_admin());

drop policy if exists replies_private_read on public.inquiry_replies;
create policy replies_private_read on public.inquiry_replies for select to authenticated using (exists(select 1 from public.inquiries i where i.id=inquiry_id and (i.owner_id=(select auth.uid()) or private.is_admin())));
drop policy if exists replies_admin_write on public.inquiry_replies;
create policy replies_admin_write on public.inquiry_replies for all to authenticated using (private.is_admin()) with check (private.is_admin() and author_id=(select auth.uid()));

drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select to anon,authenticated using (private.can_read_target(target_type,target_id));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated with check (
  owner_id=(select auth.uid())
  and split_part(storage_path,'/',1)=(select auth.uid())::text
  and private.can_manage_target(target_type,target_id)
);
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments for delete to authenticated using (private.can_manage_target(target_type,target_id));

revoke all on public.profiles,public.community_posts,public.reading_records,public.record_comments,public.community_reviews,public.inquiries,public.inquiry_replies,public.attachments from anon,authenticated;
grant select on public.community_posts,public.community_reviews,public.attachments to anon;
grant select on public.profiles,public.community_posts,public.reading_records,public.record_comments,public.community_reviews,public.inquiries,public.inquiry_replies,public.attachments to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(kind,title,body,description,visibility,pinned,book_title,meeting_at,resource_type,external_url),update(title,body,description,visibility,pinned,book_title,meeting_at,resource_type,external_url),delete on public.community_posts to authenticated;
grant insert(record_type,book_title,learning,action_plan,outcome),update(record_type,book_title,learning,action_plan,outcome),delete on public.reading_records to authenticated;
grant insert(record_id,display_name,content),update(content),delete on public.record_comments to authenticated;
grant insert(title,body,public_display_name,public_consent),update(title,body,public_display_name,public_consent),delete on public.community_reviews to authenticated;
grant insert(display_name,inquiry_type,title,body),update(display_name,inquiry_type,title,body),delete on public.inquiries to authenticated;
grant insert(inquiry_id,body),update(body),delete on public.inquiry_replies to authenticated;
grant insert(target_type,target_id,storage_path,file_name,mime_type,size_bytes),delete on public.attachments to authenticated;

create or replace function public.admin_set_membership(target_user uuid,next_status text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized' using errcode='42501'; end if;
  if next_status not in ('pending','approved','revoked') then raise exception 'invalid status'; end if;
  if target_user=auth.uid() then raise exception 'cannot change own membership'; end if;
  update public.profiles set membership_status=next_status,updated_at=now() where id=target_user and role<>'admin';
end $$;
create or replace function public.admin_review_decision(review_id uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized' using errcode='42501'; end if;
  if decision not in ('approved','rejected','pending') then raise exception 'invalid decision'; end if;
  if decision='approved' and not exists(select 1 from public.community_reviews where id=review_id and public_consent) then raise exception 'public consent required'; end if;
  update public.community_reviews set approval_status=decision,approved_by=case when decision='approved' then auth.uid() else null end,approved_at=case when decision='approved' then now() else null end where id=review_id;
end $$;
create or replace function public.admin_answer_inquiry(inquiry_id uuid,answer_body text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized' using errcode='42501'; end if;
  if char_length(trim(answer_body)) not between 1 and 20000 then raise exception 'invalid answer'; end if;
  insert into public.inquiry_replies(inquiry_id,author_id,body) values(inquiry_id,auth.uid(),trim(answer_body));
  update public.inquiries set status='answered',updated_at=now() where id=inquiry_id;
end $$;
revoke all on function public.admin_set_membership(uuid,text),public.admin_review_decision(uuid,text),public.admin_answer_inquiry(uuid,text) from public,anon;
grant execute on function public.admin_set_membership(uuid,text),public.admin_review_decision(uuid,text),public.admin_answer_inquiry(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-private','community-private',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists community_storage_read on storage.objects;
create policy community_storage_read on storage.objects for select to anon,authenticated using (
  bucket_id='community-private' and exists(select 1 from public.attachments a where a.storage_path=name and private.can_read_target(a.target_type,a.target_id))
);
drop policy if exists community_storage_insert on storage.objects;
create policy community_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='community-private' and (storage.foldername(name))[1]=(select auth.uid())::text
  and private.can_manage_target((storage.foldername(name))[2],((storage.foldername(name))[3])::uuid)
);
drop policy if exists community_storage_delete on storage.objects;
create policy community_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='community-private' and ((storage.foldername(name))[1]=(select auth.uid())::text or private.is_admin())
  and private.can_manage_target((storage.foldername(name))[2],((storage.foldername(name))[3])::uuid)
);

commit;
