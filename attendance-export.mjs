import {esc,lessonDays,eligible,withdrawalDate,monthDays} from './domain.mjs?v=20261126-features1';
import {isClosed} from './closures-domain.mjs?v=20261126-features1';
import {CLASS_ORDER,ADVANCE_ORDER,TEACHER_ORDER} from './ui-order.mjs?v=20261126-order2';
import {buildXlsx} from './excel-file.mjs?v=20261127-excel1';
const rank=(list,v)=>{const i=list.indexOf(v);return i<0?list.length:i};
export function exportDocuments({month,teacher='',classes,teachers,documents}){
 const end=monthDays(month).at(-1),map=new Map(documents.filter(d=>d.sheet.month?.slice(0,7)===month).map(d=>[String(d.sheet.class_id),d]));
 for(const c of classes){if(c.starts_on>end||(c.ends_on&&c.ends_on<month+'-01')||map.has(String(c.id)))continue;map.set(String(c.id),{sheet:{class_id:c.id,class_name:c.name,teacher_code:teachers.find(t=>t.id===c.teacher_id)?.code||c.teacher_code||'',slot:c.slot,month:month+'-01'},rows:[],records:[]});}
 const slotOrder=['월수 현행','월수 선행','화목 현행','화목 선행','토특1','토특2'];
 const classRank=s=>{const day=s.slot.startsWith('월수')?'월수':'화목';return rank((s.slot.endsWith('현행')?CLASS_ORDER:ADVANCE_ORDER)[day]||[],s.class_name)};
 return [...map.values()].filter(d=>!teacher||d.sheet.teacher_code===teacher).sort((a,b)=>rank(slotOrder,a.sheet.slot)-rank(slotOrder,b.sheet.slot)||classRank(a.sheet)-classRank(b.sheet)||rank(TEACHER_ORDER,a.sheet.teacher_code)-rank(TEACHER_ORDER,b.sheet.teacher_code)||a.sheet.class_name.localeCompare(b.sheet.class_name,'ko',{numeric:true}));
}
export function exportSheets(documents,events,month){
 const used=new Set();
 return documents.map(({sheet,rows,records})=>{
  let base=(sheet.class_name+'('+sheet.teacher_code+')').replace(/[\\/:?*\[\]\u0000-\u001f]/g,' ').replace(/^'+|'+$/g,'').trim()||'출석부';
  if(used.has(base.slice(0,31).toLocaleLowerCase()))base+=' '+sheet.slot;
  let name=base.slice(0,31),n=2;while(used.has(name.toLocaleLowerCase())){const suffix=' '+n++;name=base.slice(0,31-suffix.length)+suffix;}used.add(name.toLocaleLowerCase());
  const dates=lessonDays(month,sheet.slot),lookup=new Map(records.map(r=>[r.row_id+':'+r.lesson_date,r]));
  const active=rows.filter(r=>!r.deleted_at&&String(r.student_name||'').trim()).sort((a,b)=>a.position-b.position||Number(a.id)-Number(b.id));
  const values=active.map((r,i)=>{const withdrawn=withdrawalDate(r),label=withdrawn&&withdrawn<=monthDays(month).at(-1)?r.student_name+'\n'+Number(withdrawn.slice(5,7))+'/'+Number(withdrawn.slice(8))+' 퇴원':r.student_name;return [i+1,label,r.vehicle||'',...dates.map(date=>{if(isClosed(events,sheet.class_id,date))return '휴강';if(withdrawn===date)return '퇴원';if(!eligible(r,date))return '—';const status=lookup.get(r.id+':'+date)?.status;return status==='출석'?'○':status==='결석'?'×':status||'';})];});
  return {name,dates,rows:values,subtitle:Number(month.slice(0,4))+'년 '+Number(month.slice(5))+'월    '+sheet.class_name+'    '+sheet.slot+'    담당 '+sheet.teacher_code+(active.length?'':'    ·    명단 미입력')};
 });
}
export function createAttendanceExport({getState,readDocuments,readEvents,modal,toast,setBusy}){
 const $=s=>document.querySelector(s);let busy=false;
 function open(){
  const state=getState();if(busy||state.pending||state.loading){toast('저장과 불러오기가 끝난 뒤 다시 눌러주세요.');return;}if(!state.ready){toast('DB 연결 후 다시 눌러주세요.');return;}
  modal(`<h2>출석부 엑셀 다운</h2><form id="exportForm"><label class="field">연월<input id="exportMonth" type="month" min="2026-12" required value="${esc(state.month)}"></label><label class="field">다운로드 대상<select id="exportTeacher"><option value="">전체 반</option>${state.teachers.map(t=>`<option value="${esc(t.code)}">${esc(t.code)} 선생님 담당 반</option>`).join('')}</select></label><p class="export-hint">월수·화목·토특을 반별 시트로 저장해요.</p><p id="exportError" class="form-error" role="alert" hidden></p><div class="actions"><button type="button" class="secondary" data-close>취소</button><button id="exportSubmit" class="primary" type="submit">엑셀 다운로드</button></div></form>`);
  $('#exportForm').onsubmit=async event=>{
   event.preventDefault();const month=$('#exportMonth').value,teacher=$('#exportTeacher').value;
   if(!/^\d{4}-\d{2}$/.test(month)||month<'2026-12'||Number(month.slice(5))<1||Number(month.slice(5))>12){$('#exportError').hidden=false;$('#exportError').textContent='2026년 12월 이후의 연월을 선택해주세요.';return;}
   if(busy)return;busy=true;state.pending++;setBusy();$('#exportError').hidden=true;$('#dialog').querySelectorAll('button,input,select').forEach(e=>e.disabled=true);$('#exportSubmit').textContent='엑셀 만드는 중…';
   try{
    const [documents,events]=await Promise.all([readDocuments(month),readEvents(month)]);
    const docs=exportDocuments({month,teacher,classes:state.classes,teachers:state.teachers,documents});
    if(!docs.length)throw Error('선택한 월에 다운로드할 반이 없어요.');
    const bytes=buildXlsx(exportSheets(docs,events,month));
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`씨앤씨_${month}_${teacher||'전체반'}_출석부.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#dialog').close();toast(`${docs.length}개 반의 출석부를 내려받았어요.`);
   }catch(error){$('#exportError').hidden=false;$('#exportError').textContent=error.message;}
   finally{busy=false;state.pending--;setBusy();$('#dialog').querySelectorAll('button,input,select').forEach(e=>e.disabled=false);if($('#exportSubmit'))$('#exportSubmit').textContent='엑셀 다운로드';}
  };
 }
 return {open};
}
