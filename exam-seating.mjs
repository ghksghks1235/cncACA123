import {esc} from './domain.mjs?v=20261126-features1';
import {defaultRooms,buildRoster,validate,moveStudent,seatKey,classColor,paperCounts} from './exam-domain.mjs?v=20261127-exam1';
import {roomPdf} from './exam-pdf.mjs?v=20261127-exam1';
const $=s=>document.querySelector(s),clone=x=>structuredClone(x);
const koreanToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export function createExamSeating({getState,all,api,readDocuments,modal,toast}){
 let list=[],record=null,draft=null,day='월수',token=null,dirty=false,busy=false,selected=null,history=[],search='',classFilter='',request=0,worker=null;
 const root=()=>$('#examView');
 const current=()=>draft?.days[day];
 const editable=()=>!!token&&!busy;
 function notify(message){toast(message);}
 function changed(){dirty=true;render();}
 function checkpoint(){history.push(clone(draft));if(history.length>25)history.shift();}
 function leave(){return !dirty||confirm('저장하지 않은 자리배치 변경이 있어요. 저장하지 않고 이동할까요?');}
 function failure(error){if(/잠금.*만료|비밀번호/.test(error.message))token=null;notify(error.message);}
 async function task(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){failure(e);}finally{busy=false;render();}}
 async function refresh(){list=await all('exam_seating_plans?select=id,title,revision,updated_at&order=updated_at.desc');}
 async function load(id){
  const sequence=++request;const rows=await all(`exam_seating_plans?select=*&id=eq.${encodeURIComponent(id)}`);if(sequence!==request)return;
  if(!rows[0])throw Error('배치표를 찾을 수 없어요.');record=rows[0];draft=clone(record.payload);dirty=false;selected=null;history=[];
 }
 async function enter(){
  root().hidden=false;if(draft){render();return;}
  root().innerHTML='<div class="view-card">배치표를 불러오는 중…</div>';
  try{await refresh();if(list[0])await load(list[0].id);render();}
  catch(e){root().innerHTML=`<div class="view-card exam-setup"><h2>자리배치 저장소 연결</h2><p>처음 한 번 Supabase에서 자리배치용 SQL을 실행해주세요. SQL 상단에서 편집 비밀번호를 정할 수 있어요.</p><a class="secondary" href="exam-seating-setup.sql" download>설정 SQL 다운로드</a><button class="primary" id="examRetry">연결 다시 확인</button><p class="exam-error">${esc(e.message)}</p></div>`;$('#examRetry').onclick=enter;}
 }
 function unlock(){
  modal('<h2>자리배치 편집 잠금 해제</h2><form id="examUnlock"><label class="field">편집 비밀번호<input id="examPassword" type="password" required autocomplete="current-password" maxlength="72"></label><p id="examUnlockError" class="form-error" role="alert"></p><div class="actions"><button type="button" class="secondary" data-close>취소</button><button class="primary" type="submit">잠금 해제</button></div></form>');
  $('#examPassword').focus();$('#examUnlock').onsubmit=async event=>{event.preventDefault();const buttons=$('#dialogContent').querySelectorAll('button,input');buttons.forEach(b=>b.disabled=true);
   try{token=await api('rpc/exam_unlock',{method:'POST',body:{p_password:$('#examPassword').value}});$('#examPassword').value='';$('#dialog').close();render();notify('편집 잠금을 해제했어요. 변경 후 저장을 눌러주세요.');}
   catch(e){$('#examUnlockError').textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
  };
 }
 async function lock(){if(!leave())return;if(dirty){if(record)draft=clone(record.payload);else draft=null;dirty=false;history=[];}const old=token;token=null;render();try{await api('rpc/exam_lock',{method:'POST',body:{p_token:old}});}catch{}notify('편집을 잠갔어요.');}
 function config(isNew=false){
  if(!editable())return;const today=koreanToday(),basis=isNew?(getState().month>today.slice(0,7)?getState().month+'-01':today):draft.basisDate;
  const dates=isNew?{'월수':basis,'화목':basis}:draft.dates;
  modal(`<h2>${isNew?'새 정기고사':'시험 설정'}</h2><form id="examConfig"><label class="field">시험 이름<input id="examTitle" maxlength="100" required value="${esc(isNew?basis.slice(0,7)+' 정기고사':draft.title)}"></label><div class="exam-form-grid"><label class="field">명단 기준 날짜<input id="examBasis" type="date" min="2026-12-01" required value="${esc(basis)}"></label><label class="field">4학년 창의 시험<select id="examFourth"><option value="입문">1031 입문</option><option value="초급">1031 초급</option></select></label><label class="field">월수반 시험 날짜<input id="examDateMW" type="date" min="2026-12-01" required value="${esc(dates.월수)}"></label><label class="field">화목반 시험 날짜<input id="examDateTT" type="date" min="2026-12-01" required value="${esc(dates.화목)}"></label></div><p class="exam-hint">명단 기준 날짜의 출석부를 읽어요. 시험 날짜에는 좌석을 그대로 사용해요.</p><div class="actions"><button type="button" class="secondary" data-close>취소</button><button type="submit" class="primary">${isNew?'만들기':'적용'}</button></div></form>`);
  $('#examFourth').value=isNew?'입문':draft.fourth;
  $('#examConfig').onsubmit=event=>{event.preventDefault();if(!editable())return;
   const basisDate=$('#examBasis').value,fourth=$('#examFourth').value;
   if(!isNew&&fourth!==draft.fourth&&draft.days.월수.students.length+draft.days.화목.students.length){notify('명단이 있는 시험의 창의 과정을 바꾸려면 새 시험을 만들어주세요.');return;}
   if(isNew&&!leave())return;
   if(!isNew)checkpoint();
   const values={title:$('#examTitle').value.trim(),basisDate,fourth,dates:{월수:$('#examDateMW').value,화목:$('#examDateTT').value}};
   if(!values.title)return;
   if(isNew){record=null;draft={schema:1,...values,days:{월수:{rooms:defaultRooms(),students:[],seats:{}},화목:{rooms:defaultRooms(),students:[],seats:{}}}};history=[];day='월수';}
   else Object.assign(draft,values);
   $('#dialog').close();selected=null;changed();
  };
 }
 function roomsDialog(){
  if(!editable()||!draft)return;const plan=current(),teachers=getState().teachers;
  modal(`<h2>${day}반 강의실·감독</h2><form id="examRooms"><div class="exam-room-settings">${plan.rooms.map(r=>`<label><input type="checkbox" data-room-enabled="${r.id}" ${r.enabled?'checked':''}> ${r.id}호 <small>${r.columns.join(' / ')} · ${r.columns.reduce((a,b)=>a+b,0)}석</small><select data-room-teacher="${r.id}" aria-label="${r.id}호 감독"><option value="">감독 미정</option>${teachers.map(t=>`<option value="${esc(t.code)}" ${r.teacher===t.code?'selected':''}>${esc(t.code)}</option>`).join('')}</select></label>`).join('')}</div><p class="exam-hint">사용을 끈 강의실의 학생은 미배치로 이동해요.</p><div class="actions"><button type="button" class="secondary" data-close>취소</button><button class="primary">적용</button></div></form>`);
  $('#examRooms').onsubmit=e=>{e.preventDefault();if(!editable())return;checkpoint();for(const r of plan.rooms){r.enabled=$(`[data-room-enabled="${r.id}"]`).checked;r.teacher=$(`[data-room-teacher="${r.id}"]`).value;if(!r.enabled)for(const k of Object.keys(plan.seats))if(k.startsWith(r.id+':'))delete plan.seats[k];}$('#dialog').close();selected=null;changed();};
 }
 async function importRoster(){
  if(!editable()||!draft)return;
  if(current().students.length&&!confirm(`${day}반 명단을 다시 대조해 불러올까요? 기존 학생의 자리·불참은 유지하고, 빠진 학생은 배치에서 제외해요.`))return;
  await task(async()=>{const docs=await readDocuments(draft.basisDate.slice(0,7)),result=buildRoster(docs,draft.basisDate,day,draft.fourth);
   for(const cls of getState().classes||[]){if(![day+' 현행',day+' 선행'].includes(cls.slot)||cls.starts_on>draft.basisDate||(cls.ends_on&&cls.ends_on<draft.basisDate))continue;
    if(!docs.some(d=>String(d.sheet.class_id)===String(cls.id)))result.issues.push(`${cls.name}: 기준 월의 ${cls.slot} 출석부가 없어요. 명단을 먼저 준비해주세요.`);
   }
   if(result.issues.length){modal(`<h2>${day}반 명단 확인</h2><p>현행·선행 명단을 수정한 뒤 다시 불러와주세요.</p><ul class="exam-issues">${result.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="actions"><button class="secondary" data-close>닫기</button></div>`);return;}
   if(!result.students.length)throw Error('불러올 학생이 없어요. 해당 월 출석부 명단을 확인해주세요.');
   const plan=current(),old=new Map(plan.students.map(s=>[s.id,s]));checkpoint();
   plan.students=result.students.map(s=>({...s,absent:old.get(s.id)?.absent||false}));
   const ids=new Set(plan.students.map(s=>s.id));for(const k of Object.keys(plan.seats))if(!ids.has(plan.seats[k]))delete plan.seats[k];
   if(validate(plan).errors.length){plan.seats={};notify('반 정보가 바뀌어 기존 배치를 초기화했어요. 실행 취소로 되돌릴 수 있어요.');}else notify(`${day}반 ${plan.students.length}명의 명단을 확인했어요.`);
   dirty=true;selected=null;
  });
 }
 async function automatic(){
  if(!editable()||!current()?.students.length){notify('명단을 먼저 불러와주세요.');return;}
  if(Object.keys(current().seats).length&&!confirm(`${day}반의 현재 배치를 새로 자동배치할까요? 실행 취소로 되돌릴 수 있어요.`))return;
  await task(async()=>{
   const result=await new Promise((resolve,reject)=>{worker=new Worker(new URL('./exam-worker.mjs?v=20261127-exam1',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();worker=null;reject(Error('계산 시간이 길어 중단했어요. 현재 배치는 유지돼요.'));},60000);const finish=()=>{clearTimeout(timer);worker?.terminate();worker=null;};worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.plan);};worker.onerror=()=>{finish();reject(Error('자동배치를 실행하지 못했어요. 새로고침 후 다시 시도해주세요.'));};worker.postMessage({plan:clone(current()),seed:Date.now()});});
   const checked=validate(result);if(checked.errors.length)throw Error(checked.errors[0]);checkpoint();draft.days[day]=result;dirty=true;selected=null;
   notify(checked.unplaced.length?`${checked.unplaced.length}명이 미배치예요. 자리 수와 학년별 줄 구성을 확인해주세요. 조건을 바꿔 다시 시도할 수 있어요.`:'필수 규칙을 지켜 자동배치했어요.');
  });
 }
 function relocate(id,target){if(!editable())return;try{const next=moveStudent(current(),id,target);checkpoint();draft.days[day]=next;selected=null;changed();}catch(e){notify(e.message);}}
 function absent(id){if(!editable())return;checkpoint();const s=current().students.find(s=>s.id===id);s.absent=!s.absent;if(s.absent)for(const k of Object.keys(current().seats))if(current().seats[k]===id)delete current().seats[k];selected=null;changed();}
 async function save(){
  if(!editable()||!draft)return;
  for(const d of ['월수','화목']){const checked=validate(draft.days[d]);if(checked.errors.length){notify(d+'반: '+checked.errors[0]);return;}}
  const missing=['월수','화목'].reduce((n,d)=>n+validate(draft.days[d]).unplaced.length,0);
  if(missing&&!confirm(`참석 학생 ${missing}명이 아직 미배치예요. 현재 상태를 임시로 저장할까요?`))return;
  await task(async()=>{const value=await api('rpc/exam_save',{method:'POST',body:{p_token:token,p_id:record?.id||null,p_revision:record?.revision||0,p_payload:draft}});record=Array.isArray(value)?value[0]:value;if(!record?.payload)throw Error('저장 결과를 확인하지 못했어요. 새로 불러와 확인해주세요.');draft=clone(record.payload);dirty=false;await refresh();notify('현재 자리배치를 저장했어요.');});
 }
 function download(bytes,filename,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function pdfDialog(){
  if(!record){notify('배치표를 먼저 저장해주세요.');return;}if(dirty){notify('현재 변경을 저장한 뒤 PDF를 내려받아주세요.');return;}
  const saved=record.payload,plan=saved.days[day],checked=validate(plan);if(checked.errors.length){notify('배치 오류를 수정한 뒤 내려받아주세요.');return;}
  modal(`<h2>${day}반 강의실별 PDF</h2>${checked.unplaced.length?`<p class="exam-warning">참석 학생 ${checked.unplaced.length}명이 미배치 상태예요.</p>`:''}<p>강의실 하나당 A4 가로 한 페이지예요. 담당 기호와 시험지 수량은 포함되지 않아요.</p><div class="exam-pdf-buttons">${plan.rooms.filter(r=>r.enabled).map(r=>`<button class="secondary" data-room-pdf="${r.id}">${r.id}호 PDF</button>`).join('')}</div><div class="actions"><button class="secondary" data-close>닫기</button></div>`);
  document.querySelectorAll('[data-room-pdf]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const bytes=await roomPdf(saved,day,b.dataset.roomPdf);download(bytes,`${saved.title}_${day}_${b.dataset.roomPdf}호.pdf`.replace(/[\\/:*?"<>|]/g,'_'),'application/pdf');}catch(e){notify(e.message);}finally{b.disabled=false;}});
 }
 function countsDialog(){
  if(!draft)return;const plan=current(),check=validate(plan);const names=['1교시 현행','2교시 경시','3교시 창의','4교시 선행'];
  const table=room=>paperCounts(plan,room).map((items,i)=>`<div><h3>${names[i]}</h3>${items.length?items.map(([n,c])=>`<span class="exam-count">${esc(n)} <strong>${c}부</strong></span>`).join(''):'—'}</div>`).join('');
  modal(`<div class="exam-counts"><h2>${day}반 시험지 수량</h2><p>현재 배치 ${check.seated}명 기준 · 불참과 미배치 학생 제외${dirty?' · 아직 저장하지 않은 변경 포함':''}</p><h3>전체 합계</h3>${table(null)}${plan.rooms.filter(r=>r.enabled).map(r=>`<details><summary>${r.id}호</summary>${table(r.id)}</details>`).join('')}<div class="actions"><button class="secondary" data-close>닫기</button></div></div>`);
 }
 function absenceDialog(){
  if(!editable()||!draft)return;
  modal(`<h2>${day}반 시험 불참</h2><input id="examAbsentSearch" placeholder="이름 또는 현행반 검색" aria-label="불참 학생 검색"><div class="exam-absence-list">${current().students.map(s=>`<label data-absence-name="${esc(s.name+' '+s.currentClass)}"><input type="checkbox" data-absence-id="${esc(s.id)}" ${s.absent?'checked':''}><span>${esc(s.name)} <small>${esc(s.currentClass)}</small></span></label>`).join('')}</div><p>체크하면 전체 교시 불참으로 처리하고 미배치 영역으로 옮겨요.</p><div class="actions"><button class="secondary" data-close>닫기</button></div>`);
  $('#examAbsentSearch').oninput=e=>document.querySelectorAll('[data-absence-name]').forEach(el=>el.hidden=!el.dataset.absenceName.includes(e.target.value.trim()));
  document.querySelectorAll('[data-absence-id]').forEach(el=>el.onchange=()=>absent(el.dataset.absenceId));
 }
 function card(s){return `<div class="exam-student ${s.absent?'exam-absent':''} ${selected===s.id?'exam-selected':''}" style="--student-color:${classColor(s.currentClass)}" data-student="${esc(s.id)}" draggable="${editable()}" ${editable()?'tabindex="0" role="button"':''} aria-label="${esc(s.name+' '+s.currentClass+' '+s.advanceClass+' '+s.advanceTeacher+(s.absent?' 불참':''))}"><span><strong>${esc(s.name)}</strong><small>${esc(s.advanceClass)}(${esc(s.advanceTeacher)})</small></span>${s.absent?'<em>불참</em>':''}</div>`;}
 function render(){
  const focus=document.activeElement,focusId=focus?.id,position=focus?.selectionStart;
  const s=getState(),can=editable();
  root().innerHTML=`<section class="view-card exam-controls"><div class="exam-control-row"><label>정기고사<select id="examSaved"><option value="">${draft&&!record?'새 시험 · 저장 전':'저장된 시험 선택'}</option>${list.map(x=>`<option value="${x.id}" ${record?.id===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label><button class="secondary" id="examReload" ${busy?'disabled':''}>새로 고침</button><button class="${token?'secondary':'primary'}" id="examEdit" ${busy?'disabled':''}>${token?'편집 잠그기':'편집 잠금 해제'}</button>${token?`<button class="secondary" id="examNew" ${busy?'disabled':''}>새 시험</button>`:''}</div>${draft?`<div class="exam-control-row"><div class="segmented"><button data-exam-day="월수" class="${day==='월수'?'selected':''}" ${busy?'disabled':''}>월수반</button><button data-exam-day="화목" class="${day==='화목'?'selected':''}" ${busy?'disabled':''}>화목반</button></div><span class="exam-meta">${esc(draft.title)} · ${esc(draft.dates[day])} · 명단 기준 ${esc(draft.basisDate)}</span><span class="exam-save-state ${dirty?'exam-dirty':''}">${busy?'처리 중…':dirty?'저장하지 않은 변경':'저장된 배치표'}</span></div>`:''}</section>`;
  $('#examEdit').onclick=()=>token?lock():unlock();
  $('#examNew')?.addEventListener('click',()=>config(true));
  $('#examSaved').onchange=async event=>{if(!event.target.value||!leave()){render();return;}await task(()=>load(event.target.value));};
  $('#examReload').onclick=async()=>{if(!leave())return;await task(async()=>{await refresh();if(record)await load(record.id);else if(list[0])await load(list[0].id);});};
  document.querySelectorAll('[data-exam-day]').forEach(b=>b.onclick=()=>{day=b.dataset.examDay;selected=null;search='';classFilter='';render();});
  if(!draft){root().insertAdjacentHTML('beforeend',`<div class="view-card exam-empty"><h2>저장된 자리배치표가 없어요</h2><p>${token?'새 시험을 만든 뒤 월수·화목 명단을 불러와주세요.':'편집 잠금을 해제하면 새 시험을 만들 수 있어요.'}</p></div>`);return;}
  const plan=current(),check=validate(plan),placed=new Set(Object.values(plan.seats)),pool=plan.students.filter(x=>!placed.has(x.id)),students=new Map(plan.students.map(x=>[x.id,x]));
  const capacity=plan.rooms.filter(r=>r.enabled).reduce((sum,r)=>sum+r.columns.reduce((a,b)=>a+b,0),0),absents=plan.students.filter(x=>x.absent).length;
  root().insertAdjacentHTML('beforeend',`<div class="exam-toolbar"><div><strong>${check.seated}명 배치</strong><span> / 참석 ${plan.students.length-absents}명 · ${capacity}석 · 미배치 ${check.unplaced.length}명 · 불참 ${absents}명</span></div><div class="exam-actions">${token?`<button class="secondary" id="examSettings" ${!can?'disabled':''}>시험 설정</button><button class="secondary" id="examImport" ${!can?'disabled':''}>명단 불러오기</button><button class="secondary" id="examRoomSettings" ${!can?'disabled':''}>강의실·감독</button><button class="secondary" id="examAbsences" ${!can?'disabled':''}>불참 학생</button><button class="primary" id="examAuto" ${!can||!plan.students.length?'disabled':''}>자동배치</button><button class="secondary" id="examClear" ${!can?'disabled':''}>배치 비우기</button><button class="secondary" id="examUndo" ${!can||!history.length?'disabled':''}>실행 취소</button><button class="primary" id="examSave" ${!can||!dirty?'disabled':''}>현재 상태 저장</button>`:''}<button class="secondary" id="examPapers" ${busy?'disabled':''}>시험지 수량</button><button class="secondary" id="examPDF" ${busy?'disabled':''}>인쇄용 PDF</button></div></div>${check.unplaced.length?`<div class="exam-warning">참석 학생 ${check.unplaced.length}명이 미배치예요. ${capacity<plan.students.length-absents?'전체 좌석이 부족해요. 임시 강의실 사용 또는 불참 명단을 확인해주세요.':'자동배치를 실행하거나, 학년별 줄 구성과 빈자리를 확인해 배치해주세요.'}</div>`:''}${check.errors.length?`<div class="exam-error">${check.errors.map(esc).join('<br>')}</div>`:''}${check.teacherOverlap.length?`<details class="exam-overlap"><summary>현행 담임과 겹친 학생 ${check.teacherOverlap.length}명 · 허용</summary>${check.teacherOverlap.map(x=>esc(x.name+'('+x.currentClass+')')).join(', ')}</details>`:''}<div class="exam-workspace"><aside class="exam-pool"><div class="exam-pool-head"><h2>미배치 <small>${pool.length}</small></h2><input id="examSearch" placeholder="이름 검색" aria-label="미배치 이름 검색" value="${esc(search)}"><select id="examClassFilter" aria-label="현행반 필터"><option value="">모든 현행반</option>${[...new Set(plan.students.map(x=>x.currentClass))].map(name=>`<option value="${esc(name)}" ${classFilter===name?'selected':''}>${esc(name)}</option>`).join('')}</select>${can?'<p>학생을 끌거나, 학생 선택 후 좌석을 눌러요. 여기로 옮기면 자리만 해제돼요.</p>':''}</div><div class="exam-pool-list" data-pool>${pool.filter(x=>(!classFilter||x.currentClass===classFilter)&&x.name.includes(search)).reduce((html,x,i,a)=>html+(i===0||a[i-1].currentClass!==x.currentClass?`<h3><i style="background:${classColor(x.currentClass)}"></i>${esc(x.currentClass)}</h3>`:'')+card(x),'')||'<p class="exam-hint">표시할 학생이 없어요.</p>'}</div></aside><div class="exam-rooms">${plan.rooms.filter(r=>r.enabled).map(room=>`<section class="exam-room"><header><h2>${room.id}호 <small>${day}반 · ${esc(room.teacher||'감독 미정')}</small></h2><span>${room.columns.reduce((a,b)=>a+b,0)}석</span></header><div class="exam-board">칠판</div><div class="exam-columns" style="--columns:${room.columns.length}">${room.columns.map((n,c)=>`<div class="exam-column"><h3>${esc(check.labels[room.id+':'+c]||'빈 줄')}</h3>${Array.from({length:n},(_,r)=>{const key=seatKey(room.id,c,r),student=students.get(plan.seats[key]);return `<div class="exam-seat" data-seat="${key}" ${can?'tabindex="0" role="button"':''} aria-label="${room.id}호 ${c+1}열 ${r+1}번 ${student?esc(student.name):'빈자리'}">${student?card(student):`<span class="exam-seat-number">${c+1}-${r+1}</span>`}</div>`;}).join('')}</div>`).join('')}</div></section>`).join('')}</div></div><div class="exam-legend">${[...new Set(plan.students.map(x=>x.currentClass))].map(name=>`<span><i style="background:${classColor(name)}"></i>${esc(name)}</span>`).join('')}</div>`);
  const bind=(id,fn)=>$('#'+id)?.addEventListener('click',fn);
  bind('examSettings',()=>config());bind('examImport',importRoster);bind('examRoomSettings',roomsDialog);bind('examAbsences',absenceDialog);bind('examAuto',automatic);bind('examSave',save);bind('examPapers',countsDialog);bind('examPDF',pdfDialog);
  bind('examClear',()=>{if(!editable()||!confirm(`${day}반 좌석을 모두 비울까요? 불참 상태와 명단은 유지돼요.`))return;checkpoint();plan.seats={};selected=null;changed();});
  bind('examUndo',()=>{if(!editable()||!history.length)return;draft=history.pop();selected=null;changed();});
  $('#examSearch').oninput=e=>{search=e.target.value;render();};$('#examClassFilter').onchange=e=>{classFilter=e.target.value;render();};
  if(can)bindDrag();
  if(focusId==='examSearch'&&$('#examSearch')){$('#examSearch').focus();$('#examSearch').setSelectionRange(position,position);}
 }
 function highlights(id){root().querySelectorAll('[data-seat]').forEach(el=>{try{moveStudent(current(),id,el.dataset.seat);el.classList.add('exam-can-drop');}catch{el.classList.add('exam-no-drop');}});}
 function clearHighlights(){root().querySelectorAll('.exam-can-drop,.exam-no-drop').forEach(el=>el.classList.remove('exam-can-drop','exam-no-drop'));}
 function bindDrag(){
  root().querySelectorAll('[data-student]').forEach(el=>{
   el.onclick=e=>{e.stopPropagation();const id=el.dataset.student;if(selected&&selected!==id&&el.closest('[data-seat]')){relocate(selected,el.closest('[data-seat]').dataset.seat);return;}selected=selected===id?null:id;render();if(selected)highlights(selected);};
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};
   el.ondragstart=e=>{if(!editable()){e.preventDefault();return;}selected=el.dataset.student;e.dataTransfer.setData('text/plain',selected);e.dataTransfer.effectAllowed='move';highlights(selected);};el.ondragend=clearHighlights;
  });
  root().querySelectorAll('[data-seat]').forEach(el=>{el.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};el.ondrop=e=>{e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData('text/plain');relocate(id,el.dataset.seat);};el.onclick=()=>{if(selected)relocate(selected,el.dataset.seat);};el.onkeydown=e=>{if(e.target!==el)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};});
  const pool=$('[data-pool]');pool.ondragover=e=>e.preventDefault();pool.ondrop=e=>{e.preventDefault();relocate(e.dataTransfer.getData('text/plain'),null);};pool.onclick=e=>{if(selected&&!e.target.closest('[data-student]'))relocate(selected,null);};
 }
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 return {enter,canLeave:()=>!busy&&leave(),isBusy:()=>busy};
}
