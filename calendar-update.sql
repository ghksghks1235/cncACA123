-- 일정 색상 / 전체·반별 휴강. 기존 일정과 출결은 삭제하지 않습니다.
begin;
alter table public.academy_events
 add column if not exists color text not null default 'blue',
 add column if not exists is_closure boolean not null default false,
 add column if not exists closure_all boolean not null default false,
 add column if not exists closure_class_ids bigint[] not null default '{}';

create or replace function public.validate_closure_event() returns trigger
language plpgsql set search_path=public as $$
declare v_date date;
begin
 -- 출결 저장과 휴강 변경을 날짜별로 직렬화합니다.
 for v_date in select distinct d from unnest(array[new.event_date,
   case when tg_op='UPDATE' then old.event_date else new.event_date end]) as dates(d) order by d
 loop
  perform pg_advisory_xact_lock(hashtextextended('cnc-closure:'||v_date::text,0));
 end loop;
 if new.color is null or new.color not in ('blue','green','yellow','pink','purple','gray') then
  raise exception '올바른 일정 색상을 선택해주세요.';
 end if;
 if new.is_closure is null or new.closure_all is null or new.closure_class_ids is null then
  raise exception '휴강 설정을 확인해주세요.';
 end if;
 if new.deleted_at is not null then return new; end if;
 if not new.is_closure then
  new.closure_all:=false; new.closure_class_ids:='{}';
 elsif new.closure_all then
  new.closure_class_ids:='{}';
 else
  if cardinality(new.closure_class_ids)=0 or exists(
   select 1 from unnest(new.closure_class_ids) as ids(id)
   where not exists(select 1 from public.classes c where c.id=ids.id
    and c.starts_on<=new.event_date and (c.ends_on is null or c.ends_on>=new.event_date))
  ) then raise exception '해당 날짜에 운영하는 휴강 대상 반을 선택해주세요.'; end if;
  select array_agg(distinct id order by id) into new.closure_class_ids
  from unnest(new.closure_class_ids) as ids(id);
 end if;
 return new;
end;
$$;
drop trigger if exists academy_event_closure_guard on public.academy_events;
create trigger academy_event_closure_guard before insert or update on public.academy_events
for each row execute function public.validate_closure_event();

create or replace function public.prevent_closed_attendance() returns trigger
language plpgsql set search_path=public as $$
declare v_date date; v_row_id bigint; v_class_id bigint;
begin
 if tg_op='DELETE' then v_date:=old.lesson_date;v_row_id:=old.row_id;
 else v_date:=new.lesson_date;v_row_id:=new.row_id; end if;
 perform pg_advisory_xact_lock(hashtextextended('cnc-closure:'||v_date::text,0));
 select s.class_id into v_class_id from public.attendance_rows r
 join public.attendance_sheets s on s.id=r.sheet_id where r.id=v_row_id;
 if exists(select 1 from public.academy_events e
   where e.deleted_at is null and e.is_closure and e.event_date=v_date
   and (e.closure_all or v_class_id=any(e.closure_class_ids))) then
  raise exception '휴강일에는 출결을 변경할 수 없습니다. 일정의 휴강 설정을 먼저 해제해주세요.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
drop trigger if exists attendance_closure_guard on public.attendance_records;
create trigger attendance_closure_guard before insert or update or delete on public.attendance_records
for each row execute function public.prevent_closed_attendance();
revoke execute on function public.validate_closure_event() from public,anon,authenticated;
revoke execute on function public.prevent_closed_attendance() from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
select '일정 색상과 휴강 기능 준비 완료' as result;
