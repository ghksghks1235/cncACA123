-- 이전 달 명단을 버튼으로 불러오는 기능
-- 실행 자체로 기존 명단이나 출결을 변경하지 않습니다.
begin;

-- 기존 함수도 자동 복사 없이 빈 문서만 생성하도록 변경
create or replace function public.open_attendance_sheet(
  p_class_id bigint, p_month date
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_sheet_id bigint;
  v_teacher_code text;
  v_month_end date;
begin
  if p_class_id is null or p_month is null
     or extract(day from p_month) <> 1 then
    raise exception '반과 해당 월의 1일을 지정해주세요.';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_class_id::text || ':' || p_month::text, 0)
  );
  select id into v_sheet_id from public.attendance_sheets
  where class_id = p_class_id and month = p_month;
  if found then return v_sheet_id; end if;

  select * into v_class from public.classes where id = p_class_id;
  if not found then raise exception '반을 찾을 수 없습니다.'; end if;
  v_month_end := (p_month + interval '1 month' - interval '1 day')::date;
  if not v_class.active or v_class.starts_on > v_month_end
     or (v_class.ends_on is not null and v_class.ends_on < p_month) then
    raise exception '이 달에는 운영하지 않는 반입니다.';
  end if;
  select code into v_teacher_code from public.teachers
  where id = v_class.teacher_id;
  insert into public.attendance_sheets (
    class_id, month, class_name, teacher_code, slot
  ) values (
    v_class.id, p_month, v_class.name, v_teacher_code, v_class.slot
  ) returning id into v_sheet_id;
  return v_sheet_id;
end;
$$;

-- 새 화면용 함수명: 업데이트 전 자동 복사 함수 호출을 방지
create or replace function public.open_attendance_document(
  p_class_id bigint, p_month date
)
returns bigint
language sql
set search_path = public
as $$
  select public.open_attendance_sheet(p_class_id, p_month);
$$;

create or replace function public.import_previous_roster(
  p_sheet_id bigint, p_replace boolean default false
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_target public.attendance_sheets%rowtype;
  v_source_id bigint;
  v_source_count integer;
  v_count integer;
  v_month_end date;
begin
  -- 행 추가·출결 저장과 충돌하지 않도록 문서와 기존 행 잠금
  select * into v_target from public.attendance_sheets
  where id = p_sheet_id for update;
  if not found then raise exception '출석부를 찾을 수 없습니다.'; end if;

  perform 1 from public.attendance_rows
  where sheet_id = p_sheet_id order by id for update;

  -- 삭제한 행까지 포함해 출결 기록이 있는 문서는 덮어쓰지 않음
  if exists (
    select 1 from public.attendance_records a
    join public.attendance_rows r on r.id = a.row_id
    where r.sheet_id = p_sheet_id
  ) then
    raise exception '이미 출결 기록이 있어 명단을 덮어쓸 수 없습니다. 행 추가·삭제로 수정해주세요.';
  end if;

  select id into v_source_id from public.attendance_sheets
  where class_id = v_target.class_id
    and month = (v_target.month - interval '1 month')::date;
  if not found then raise exception '같은 반의 이전 달 출석부가 없습니다.'; end if;

  v_month_end := (v_target.month + interval '1 month' - interval '1 day')::date;
  select count(*) into v_source_count from public.attendance_rows
  where sheet_id = v_source_id and deleted_at is null
    and btrim(student_name) <> ''
    and (ends_on is null or ends_on >= v_target.month)
    and (starts_on is null or starts_on <= v_month_end);
  if v_source_count = 0 then
    raise exception '이전 달에 불러올 학생 명단이 없습니다.';
  end if;

  if p_replace is distinct from true and exists (
    select 1 from public.attendance_rows
    where sheet_id = p_sheet_id and deleted_at is null
  ) then
    raise exception '현재 명단이 있습니다. 교체 여부를 확인해주세요.';
  end if;

  -- 기존 행은 복구할 수 있게 숨김 처리. 이전 달은 변경하지 않음.
  update public.attendance_rows set deleted_at = now()
  where sheet_id = p_sheet_id and deleted_at is null;

  insert into public.attendance_rows (
    sheet_id, position, student_name, vehicle, starts_on, ends_on
  )
  select p_sheet_id,
    row_number() over (order by position, id)::integer,
    student_name, vehicle, starts_on, ends_on
  from public.attendance_rows
  where sheet_id = v_source_id and deleted_at is null
    and btrim(student_name) <> ''
    and (ends_on is null or ends_on >= v_target.month)
    and (starts_on is null or starts_on <= v_month_end);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception '이전 달 명단이 변경되었습니다. 다시 확인 후 불러와주세요.';
  end if;
  return v_count;
end;
$$;

revoke execute on function public.open_attendance_document(bigint,date)
  from public, authenticated;
revoke execute on function public.import_previous_roster(bigint,boolean)
  from public, authenticated;
grant execute on function public.open_attendance_sheet(bigint,date) to anon;
grant execute on function public.open_attendance_document(bigint,date) to anon;
grant execute on function public.import_previous_roster(bigint,boolean) to anon;

commit;
