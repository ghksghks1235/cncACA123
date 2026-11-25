export const STATUSES=['출석','결석','지각','조퇴'];
export const statusClass=s=>s==='출석'?'present':s==='결석'?'absent':['지각','조퇴'].includes(s)?'late':s==='보강'?'makeup':'';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function monthDays(month){const [y,m]=month.split('-').map(Number);return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)}
export function lessonDays(month,slot){const weekdays=slot.startsWith('월수')?[1,3]:slot.startsWith('화목')?[2,4]:[6];return monthDays(month).filter(d=>weekdays.includes(new Date(d+'T12:00:00').getDay()))}
export function eligible(row,date){return !row.deleted_at&&(!row.starts_on||row.starts_on<=date)&&(!row.ends_on||row.ends_on>=date)}
export function previousMonth(month){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
export function stats(rows,records,dates){const active=rows.filter(r=>!r.deleted_at),ids=new Set(active.map(r=>r.id));const rec=records.filter(r=>ids.has(r.row_id)&&dates.includes(r.lesson_date));return {students:active.length,present:rec.filter(r=>r.status==='출석').length,absent:rec.filter(r=>r.status==='결석').length,blank:active.reduce((n,r)=>n+dates.filter(d=>eligible(r,d)&&!rec.some(a=>a.row_id===r.id&&a.lesson_date===d)).length,0)}}

export function groupStudentAttendance(found){
 const students=new Map();
 for(const {row,sheet,records} of found){
  if(!students.has(row.student_name))students.set(row.student_name,{name:row.student_name,dates:new Map(),unentered:[]});
  const student=students.get(row.student_name);
  if(!records.length)student.unentered.push(sheet);
  for(const record of records){if(!student.dates.has(record.lesson_date))student.dates.set(record.lesson_date,[]);student.dates.get(record.lesson_date).push({sheet,...record})}
 }
 return [...students.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(s=>({...s,dates:[...s.dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,records])=>({date,records:records.sort((a,b)=>a.sheet.slot.localeCompare(b.sheet.slot,'ko')||a.sheet.class_name.localeCompare(b.sheet.class_name,'ko'))}))}));
}

export function offsetDate(date,days){const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
// DB의 마지막 수강일 다음 날이 화면에 표시하는 퇴원 날짜입니다.
export function withdrawalDate(row){return row.ends_on?offsetDate(row.ends_on,1):null}
export function vehicleCopyText(rows){return rows.map(r=>{const vehicle=String(r.vehicle||'').trim().replace(/\s*호차$/,'');return `${r.student_name}-${vehicle||'미입력'}`}).join(', ')}
