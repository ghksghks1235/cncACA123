import {monthDays} from './domain.mjs?v=20261125-pwa1';
export function calendarClasses(classes,teachers,docs,month,day){
 const available=new Map();
 for(const c of classes.filter(c=>c.slot.startsWith(day)&&c.starts_on<=monthDays(month).at(-1)&&(!c.ends_on||c.ends_on>=month+'-01')))available.set(c.id,{id:c.id,name:c.name,teacher:teachers.find(t=>t.id===c.teacher_id)?.code||'',slot:c.slot});
 for(const {sheet} of docs.filter(d=>d.sheet.slot.startsWith(day)))available.set(sheet.class_id,{id:sheet.class_id,name:sheet.class_name,teacher:sheet.teacher_code,slot:sheet.slot});
 return [...available.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.teacher.localeCompare(b.teacher));
}
export function attendanceEvents(docs,{mode,teacher,classId}){
 const matching=docs.filter(d=>mode==='teacher'?d.sheet.teacher_code===teacher:d.sheet.class_id===classId);
 return matching.flatMap(d=>d.records.flatMap(rec=>{const row=d.rows.find(r=>r.id===rec.row_id&&!r.deleted_at);return row&&['결석','지각','조퇴'].includes(rec.status)?[{...rec,name:row.student_name,cls:d.sheet.class_name,teacher:d.sheet.teacher_code,slot:d.sheet.slot}]:[]}));
}
export function schedulePayload(date,title,teacher){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('올바른 날짜를 선택해주세요.');const name=title.trim();if(!name||name.length>120)throw new Error('일정 이름을 1~120자로 입력해주세요.');return {event_date:date,title:name,updated_by:teacher};}
