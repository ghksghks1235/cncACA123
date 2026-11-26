import {esc,monthDays,offsetDate,withdrawalDate,vehicleCopyText} from './domain.mjs?v=20261126-features1';
export function createAttendanceTools({getState,monthData,modal,toast,mutate,rpc}){
 const $=s=>document.querySelector(s),state=()=>getState();
 async function vehicles(){
  modal('<h2>차량 명단 보기</h2><p>명단 불러오는 중…</p><div class="actions"><button class="secondary" data-close>닫기</button></div>');
  try{
   const docs=await monthData();if(!$('#dialog').open)return;
   const available=new Map();
   for(const cls of state().classes.filter(c=>c.starts_on<=monthDays(state().month).at(-1)&&(!c.ends_on||c.ends_on>=state().month+'-01'))){available.set(cls.id,{sheet:{class_id:cls.id,class_name:cls.name,slot:cls.slot,teacher_code:state().teachers.find(t=>t.id===cls.teacher_id)?.code||''},rows:[]})}
   for(const doc of docs)available.set(doc.sheet.class_id,doc);
   const options=[...available.values()].sort((a,b)=>a.sheet.class_name.localeCompare(b.sheet.class_name,'ko')||a.sheet.teacher_code.localeCompare(b.sheet.teacher_code));
   let day=state().day,selected=options.find(d=>d.sheet.class_id===state().sheet?.class_id)||options.find(d=>d.sheet.slot.startsWith(day));
   const chosen=new Set();
   const draw=()=>{
    const matching=options.filter(d=>d.sheet.slot.startsWith(day));
    if(!matching.includes(selected))selected=matching[0];
    const rows=selected?.rows.filter(r=>!r.deleted_at)||[];
    modal(`<h2>차량 명단 보기</h2><div class="field-row"><label class="field">수업 구분<select id="vehicleDay">${[ ['월수','월수반'],['화목','화목반'],['토특','토요특강'] ].map(([value,label])=>`<option value="${value}" ${value===day?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">반<select id="vehicleClass">${matching.map(d=>`<option value="${d.sheet.class_id}" ${d===selected?'selected':''}>${esc(d.sheet.class_name)}(${esc(d.sheet.teacher_code)}) · ${esc(d.sheet.slot)}</option>`).join('')||'<option value="">등록된 반 없음</option>'}</select></label></div><label class="vehicle-select-all"><input id="vehicleAll" type="checkbox" ${rows.length&&rows.every(r=>chosen.has(r.id))?'checked':''}> 전체 선택</label><div class="vehicle-list">${rows.map(r=>`<label class="vehicle-person"><input type="checkbox" data-vehicle-row="${r.id}" ${chosen.has(r.id)?'checked':''}><strong>${esc(r.student_name)}</strong><span>${esc(r.vehicle||'—')}</span></label>`).join('')||'<p>입력된 명단이 없어요.</p>'}</div><div class="actions"><button class="secondary" data-close>닫기</button><button class="primary" id="copyVehicles" ${chosen.size?'':'disabled'}>선택한 학생 복사 (${chosen.size})</button></div>`);
    $('#vehicleDay').onchange=()=>{day=$('#vehicleDay').value;selected=null;chosen.clear();draw()};
    $('#vehicleClass').onchange=()=>{selected=matching.find(d=>String(d.sheet.class_id)===$('#vehicleClass').value);chosen.clear();draw()};
    $('#vehicleAll').onchange=e=>{rows.forEach(r=>e.target.checked?chosen.add(r.id):chosen.delete(r.id));draw()};
    document.querySelectorAll('[data-vehicle-row]').forEach(input=>input.onchange=()=>{const id=Number(input.dataset.vehicleRow);input.checked?chosen.add(id):chosen.delete(id);draw()});
    $('#copyVehicles').onclick=async()=>{const text=vehicleCopyText(rows.filter(r=>chosen.has(r.id)));try{await navigator.clipboard.writeText(text);toast('선택한 학생의 이름·차량을 복사했어요')}catch{modal(`<h2>선택한 학생 차량</h2><textarea class="vehicle-copy" readonly rows="8">${esc(text)}</textarea><div class="actions"><button class="secondary" data-close>닫기</button></div>`);toast('자동 복사가 안 돼요. 표시된 내용을 직접 복사해주세요.')}};
   };draw();
  }catch(e){modal(`<h2>차량 명단을 불러오지 못했어요</h2><p>${esc(e.message)}</p><div class="actions"><button class="secondary" data-close>닫기</button></div>`)}
 }
 function withdraw(id){
  const row=state().rows.find(r=>r.id===id);if(!row)return;
  modal(`<h2>${esc(row.student_name)} · 퇴원</h2><form id="withdrawForm"><label class="field">퇴원 날짜<input id="withdrawDate" type="date" required value="${esc(withdrawalDate(row)||state().month+'-01')}" min="${state().month}-01" max="${monthDays(state().month).at(-1)}"></label><p>퇴원 날짜부터 출결 입력이 중지되고 다음 달 명단 불러오기에서 제외돼요.</p><p id="withdrawError" class="form-error" role="alert" hidden></p><div class="actions"><button type="button" class="secondary" data-close>닫기</button>${row.ends_on?'<button type="button" class="secondary" id="cancelWithdrawal">퇴원 취소</button>':''}<button class="primary" type="submit">${row.ends_on?'날짜 수정':'퇴원 처리'}</button></div></form>`);
  const save=async end=>{
   const current=state().rows.find(r=>r.id===id),conflicts=state().records.filter(r=>r.row_id===id&&end&&r.lesson_date>end);
   const error=message=>{$('#withdrawError').textContent=message;$('#withdrawError').hidden=false};
   if(end&&current.starts_on&&end<current.starts_on){error('기존 수강 시작일보다 늦은 퇴원 날짜를 선택해주세요.');return}
   if(conflicts.length){error('퇴원 날짜 이후에 입력된 출결이 있어요. 해당 출결을 먼저 빈칸으로 바꾸거나 퇴원 날짜를 조정해주세요.');return}
   $('#dialog').close();await mutate(()=>rpc('set_attendance_period',{p_row_id:id,p_starts_on:current.starts_on||null,p_ends_on:end,p_clear_conflicts:false}),end?'퇴원 날짜를 저장했어요':'퇴원을 취소했어요');
  };
  $('#withdrawForm').onsubmit=e=>{e.preventDefault();const date=$('#withdrawDate').value;if(!date)return;save(offsetDate(date,-1))};
  if($('#cancelWithdrawal'))$('#cancelWithdrawal').onclick=()=>save(null);
 }
 return {vehicles,withdraw};
}
