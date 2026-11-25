import {esc,monthDays} from './domain.mjs?v=20261125-pwa1';
import {calendarClasses,attendanceEvents,schedulePayload} from './calendar-domain.mjs?v=20261125-pwa1';
export function createCalendar({getState,api,all,monthData,modal,toast,setSave,changeMonth}){
 const $=s=>document.querySelector(s),state=()=>getState();
 let mode='schedule',classId=null,teacher='',request=0,events=[],saving=false,selectedDate=null;
 let demoEvents;try{demoEvents=JSON.parse(localStorage.getItem('cnc-demo-events')||'[]')}catch{demoEvents=[]}
 const persist=()=>localStorage.setItem('cnc-demo-events',JSON.stringify(demoEvents));
 async function enter(){mode='schedule';classId=null;await render()}
 function controls(){
  document.querySelectorAll('[data-calendar-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.calendarMode===mode);b.onclick=()=>{if(saving)return;mode=b.dataset.calendarMode;classId=null;render()}});
  $('#calendarMonth').value=state().month;
  $('#calendarMonth').onchange=()=>{const month=$('#calendarMonth').value;if(!/^\d{4}-\d{2}$/.test(month)||month<'2026-12'){toast('2026년 12월 이후를 선택해주세요.');$('#calendarMonth').value=state().month;return}changeMonth(month);render()};
  $('#calendarRefresh').onclick=render;
  $('#addEvent').hidden=mode!=='schedule';$('#addEvent').onclick=()=>openEvent();
  $('#calendarTitle').textContent=mode==='schedule'?'씨앤씨 일정':mode==='teacher'?'선생님별 출결':mode==='토특'?'토요특강 출결':mode+'반 출결';
 }
 function draw(items,schedule=false){
  const month=state().month,first=new Date(month+'-01T12:00:00').getDay();
  const eventDate=e=>schedule?e.event_date:e.lesson_date;
  if(!selectedDate?.startsWith(month)){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());selectedDate=today.startsWith(month)?today:items[0]?eventDate(items[0]):month+'-01'}
  const detailItem=e=>schedule?`<button class="calendar-event" data-event="${e.id}" aria-label="${esc(e.event_date)} ${esc(e.title)} 일정 보기">${esc(e.title)}</button>`:`<div class="calendar-item ${e.status==='결석'?'absent':'warning'}">${esc(e.name)} · ${esc(e.status)}<small>${esc(e.cls)}(${esc(e.teacher)})</small></div>`;
  $('#calendarGrid').innerHTML=Array.from({length:first},()=>'<div class="calendar-day outside"></div>').join('')+monthDays(month).map(date=>{
   const rows=items.filter(e=>eventDate(e)===date),count=schedule?rows.length+'개 일정':['결석','지각','조퇴'].map(status=>{const n=rows.filter(e=>e.status===status).length;return n?status+' '+n:''}).filter(Boolean).join(' · ');
   return `<div class="calendar-day ${new Date(date+'T12:00:00').getDay()===0?'sunday':''} ${date===selectedDate?'selected-day':''}"><div class="calendar-desktop-items"><div class="day">${Number(date.slice(8))}일</div>${rows.map(detailItem).join('')}</div><button class="calendar-mobile-day" data-calendar-date="${date}" aria-pressed="${date===selectedDate}" aria-label="${esc(date)} ${rows.length?esc(count):'기록 없음'}"><span>${Number(date.slice(8))}</span><small>${rows.length?esc(count):''}</small></button></div>`;
  }).join('');
  let detail=$('#calendarDayDetail');if(!detail){detail=document.createElement('div');detail.id='calendarDayDetail';detail.className='calendar-day-detail';detail.setAttribute('aria-live','polite');$('#calendarGrid').after(detail)}
  const chosen=items.filter(e=>eventDate(e)===selectedDate);
  detail.innerHTML=`<h3>${Number(selectedDate.slice(5,7))}월 ${Number(selectedDate.slice(8))}일 <span>${chosen.length}건</span></h3>${chosen.map(detailItem).join('')||'<p>등록된 '+(schedule?'일정':'결석·지각·조퇴 기록')+'이 없어요.</p>'}`;
  document.querySelectorAll('[data-calendar-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.calendarDate;draw(items,schedule)});
  document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>eventDetail(events.find(e=>String(e.id)===b.dataset.event)));
 }
 async function render(){
  const current=++request,month=state().month;controls();$('#calendarGrid').innerHTML='<div class="empty">불러오는 중…</div>';$('#calendarSelection').innerHTML='';$('#calendarScope').textContent='';$('#calendarSetup').hidden=true;if($('#calendarDayDetail'))$('#calendarDayDetail').innerHTML='';
  try{
   if(mode==='schedule'){
    try{events=state().demo?demoEvents.filter(e=>!e.deleted_at&&e.event_date.startsWith(month)):await all(`academy_events?select=*&deleted_at=is.null&event_date=gte.${month}-01&event_date=lte.${monthDays(month).at(-1)}&order=event_date,id`)}catch(e){if(current!==request)return;draw([],true);$('#calendarSetup').hidden=false;$('#calendarScope').textContent='일정 연결 확인 필요';setSave('일정 DB 연결 확인 필요',true);return}
    if(current!==request||state().view!=='calendar')return;draw(events,true);$('#calendarScope').textContent=`${Number(month.slice(0,4))}년 ${Number(month.slice(5))}월 · ${events.length}개 일정`;
   }else{
    const docs=await monthData();if(current!==request||state().view!=='calendar')return;
    if(mode==='teacher'){
     if(!state().teachers.some(t=>t.code===teacher))teacher=state().teacher;
     $('#calendarSelection').innerHTML=`<div class="calendar-teachers">${state().teachers.map(t=>`<button class="cal-class ${teacher===t.code?'active':''}" data-cal-teacher="${esc(t.code)}">${esc(t.code)}</button>`).join('')}</div>`;
     document.querySelectorAll('[data-cal-teacher]').forEach(b=>b.onclick=()=>{teacher=b.dataset.calTeacher;render()});
    }else{
     const classes=calendarClasses(state().classes,state().teachers,docs,month,mode);if(!classes.some(c=>c.id===classId))classId=(classes.find(c=>c.slot.endsWith('현행'))||classes[0])?.id??null;
     const groups=mode==='토특'?[{title:'토요특강',rows:classes}]:[{title:'현행',rows:classes.filter(c=>c.slot.endsWith('현행'))},{title:'선행',rows:classes.filter(c=>c.slot.endsWith('선행'))}];
     $('#calendarSelection').innerHTML=groups.map(g=>`<div class="calendar-class-row"><span>${g.title}</span><div>${g.rows.map(c=>`<button class="cal-class ${classId===c.id?'active':''}" data-cal-class="${c.id}">${esc(c.name)}(${esc(c.teacher)})</button>`).join('')||'<small>등록된 반이 없어요</small>'}</div></div>`).join('');
     document.querySelectorAll('[data-cal-class]').forEach(b=>b.onclick=()=>{classId=Number(b.dataset.calClass);render()});
    }
    const items=attendanceEvents(docs,{mode,teacher,classId});draw(items);$('#calendarScope').textContent=mode==='teacher'?`${teacher} · 월수·화목·토특 전체 · ${items.length}건`:`${items.length}건 · 결석·지각·조퇴`;
   }
   setSave(state().demo?'체험 캘린더':'캘린더를 불러왔어요');
  }catch(e){if(current===request){$('#calendarGrid').innerHTML=`<div class="empty">${esc(e.message)}</div>`;setSave('캘린더 불러오기 실패',true)}}
 }
 function eventDetail(event){if(!event)return;modal(`<h2>${esc(event.title)}</h2><p>${esc(event.event_date)}</p><div class="actions"><button class="secondary" data-close>닫기</button><button class="secondary" id="editEvent">수정</button><button class="secondary calendar-danger" id="deleteEvent">삭제</button></div>`);$('#editEvent').onclick=()=>openEvent(event);$('#deleteEvent').onclick=()=>{modal(`<h2>일정 삭제</h2><p>${esc(event.event_date)} · ${esc(event.title)}<br>이 일정을 삭제할까요?</p><div id="eventError" role="alert" class="form-error" hidden></div><div class="actions"><button class="secondary" id="cancelEventDelete">취소</button><button class="primary" id="confirmEventDelete">삭제</button></div>`);$('#cancelEventDelete').onclick=()=>eventDetail(event);$('#confirmEventDelete').onclick=()=>saveEvent(event,null,true)}}
 function openEvent(event=null){const date=event?.event_date||state().month+'-01';modal(`<h2>${event?'일정 수정':'일정 추가'}</h2><form id="eventForm"><label class="field">날짜<input id="eventDate" type="date" required value="${esc(date)}"></label><label class="field">일정 이름<input id="eventTitle" required maxlength="120" placeholder="예: 휴가, 정기고사" value="${esc(event?.title||'')}"></label><p id="eventError" role="alert" class="form-error" hidden></p><div class="actions"><button class="secondary" type="button" data-close>취소</button><button class="primary" type="submit">저장</button></div></form>`);$('#eventForm').onsubmit=e=>{e.preventDefault();let body;try{body=schedulePayload($('#eventDate').value,$('#eventTitle').value,state().teacher)}catch(error){$('#eventError').hidden=false;$('#eventError').textContent=error.message;return}saveEvent(event,body)}}
 async function saveEvent(event,body,deleting=false){
  if(saving)return;saving=true;state().pending++;$('#dialog').querySelectorAll('button,input').forEach(e=>e.disabled=true);setSave(deleting?'일정 삭제 중…':'일정 저장 중…');
  try{
   const now=new Date().toISOString(),payload=deleting?{deleted_at:now,updated_by:state().teacher}:body;
   if(state().demo){if(event){const old=demoEvents.find(e=>e.id===event.id&&!e.deleted_at);if(!old||old.updated_at!==event.updated_at)throw new Error('다른 곳에서 변경된 일정이에요. 새로 고침해주세요.');Object.assign(old,payload,{updated_at:now})}else demoEvents.push({...body,id:Date.now(),created_by:state().teacher,created_at:now,updated_at:now,deleted_at:null});persist()}
   else if(event){const result=await api(`academy_events?id=eq.${event.id}&updated_at=eq.${encodeURIComponent(event.updated_at)}&deleted_at=is.null`,{method:'PATCH',body:payload});if(!result?.length)throw new Error('다른 곳에서 변경된 일정이에요. 새로 고침해주세요.')}
   else await api('academy_events',{method:'POST',body:{...body,created_by:state().teacher}});
   $('#dialog').close();await render();toast(deleting?'일정을 삭제했어요':'일정을 저장했어요');
  }catch(e){$('#eventError').hidden=false;$('#eventError').textContent=e.message;$('#dialog').querySelectorAll('button,input').forEach(el=>el.disabled=false);setSave('일정 저장 실패',true)}finally{saving=false;state().pending--}
 }
 async function showSetup(){const response=await fetch('calendar-setup.sql'),sql=await response.text();modal(`<h2>씨앤씨 일정 DB 연결</h2><p>Supabase의 SQL Editor에서 아래 SQL을 한 번 실행해주세요.</p><pre>${esc(sql)}</pre><div class="actions"><button class="secondary" data-close>닫기</button><button class="primary" id="copyCalendarSQL">SQL 복사</button></div>`);$('#copyCalendarSQL').onclick=async()=>{try{await navigator.clipboard.writeText(sql);toast('SQL을 복사했어요')}catch{toast('SQL을 직접 선택해 복사해주세요.')}}}
 $('#calendarSetupButton').onclick=showSetup;
 return {enter,render};
}
