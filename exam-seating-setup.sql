-- 정기고사 자리배치 전용 저장소입니다. 기존 출석부·진도 데이터는 변경하지 않습니다.
-- 아래 비밀번호 한 곳만 원하는 값으로 바꾼 뒤, 전체를 한 번 실행하세요.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists exam_private;
revoke all on schema exam_private from public, anon, authenticated;
create table if not exists exam_private.settings(singleton boolean primary key default true check(singleton),password_hash text not null);
create table if not exists exam_private.sessions(token_hash bytea primary key,expires_at timestamptz not null);
alter table exam_private.settings enable row level security;
alter table exam_private.sessions enable row level security;
revoke all on all tables in schema exam_private from public, anon, authenticated;
do $setup$
declare v_password text := '여기에_편집비밀번호_입력';
begin
 if v_password='여기에_편집비밀번호_입력' or length(v_password)<4 or octet_length(v_password)>72 then
  raise exception 'SQL 상단의 편집비밀번호를 4자 이상, 72바이트 이하로 바꿔주세요.';
 end if;
 insert into exam_private.settings values(true,extensions.crypt(v_password,extensions.gen_salt('bf',10)))
 on conflict(singleton) do update set password_hash=excluded.password_hash;
 delete from exam_private.sessions;
end $setup$;
create table if not exists public.exam_seating_plans(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 100),
 payload jsonb not null,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.exam_seating_plans enable row level security;
revoke all on public.exam_seating_plans from anon,authenticated;
grant select on public.exam_seating_plans to anon,authenticated;
drop policy if exists exam_read on public.exam_seating_plans;
create policy exam_read on public.exam_seating_plans for select to anon,authenticated using(true);

create or replace function public.exam_unlock(p_password text) returns uuid
language plpgsql security definer set search_path=pg_catalog,extensions as $fn$
declare v_hash text; v_token uuid;
begin
 select password_hash into v_hash from exam_private.settings where singleton;
 if p_password is null or length(p_password)>72 or v_hash is null or extensions.crypt(p_password,v_hash)<>v_hash then
  raise exception '비밀번호가 맞지 않아요.';
 end if;
 delete from exam_private.sessions where expires_at<now();
 v_token:=gen_random_uuid();
 insert into exam_private.sessions values(sha256(convert_to(v_token::text,'UTF8')),now()+interval '4 hours');
 return v_token;
end $fn$;

create or replace function public.exam_lock(p_token uuid) returns void
language sql security definer set search_path=pg_catalog as $fn$
 delete from exam_private.sessions where token_hash=sha256(convert_to(p_token::text,'UTF8'));
$fn$;

create or replace function public.exam_save(p_token uuid,p_id uuid,p_revision integer,p_payload jsonb)
returns public.exam_seating_plans language plpgsql security definer set search_path=pg_catalog as $fn$
declare v_result public.exam_seating_plans;
begin
 if not exists(select 1 from exam_private.sessions where token_hash=sha256(convert_to(p_token::text,'UTF8')) and expires_at>now()) then
  raise exception '편집 잠금이 만료됐어요. 비밀번호를 다시 입력해주세요.';
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>2000000
  or coalesce(length(trim(p_payload->>'title')),0) not between 1 and 100
  or jsonb_typeof(p_payload->'days') is distinct from 'object'
  or jsonb_typeof(p_payload#>'{days,월수,students}') is distinct from 'array'
  or jsonb_typeof(p_payload#>'{days,화목,students}') is distinct from 'array' then
  raise exception '배치표 형식이 올바르지 않아요.';
 end if;
 if p_id is null then
  insert into public.exam_seating_plans(title,payload) values(trim(p_payload->>'title'),p_payload) returning * into v_result;
 else
  update public.exam_seating_plans set title=trim(p_payload->>'title'),payload=p_payload,revision=revision+1,updated_at=now()
  where id=p_id and revision=p_revision returning * into v_result;
  if not found then raise exception '다른 화면에서 배치표가 변경됐어요. 현재 내용을 보관한 뒤 새로 불러와주세요.';end if;
 end if;
 return v_result;
end $fn$;
revoke all on function public.exam_unlock(text),public.exam_lock(uuid),public.exam_save(uuid,uuid,integer,jsonb) from public;
grant execute on function public.exam_unlock(text),public.exam_lock(uuid),public.exam_save(uuid,uuid,integer,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
