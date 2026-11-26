import {esc} from './domain.mjs?v=20261126-features1';
import {dutyFor} from './duties.mjs?v=20261126-features1';

export function koreanToday(now=new Date()) {
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}

export function dailyLines({date,teacher,teachers=[],classes=[],events=[]}) {
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 const duty=dutyFor(date.slice(0,7),teacher),lines=[];
 if([1,2,3,4,6].includes(weekday)&&!['없음','미등록'].includes(duty.vehicle))lines.push('차량 '+duty.vehicle);
 const day=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][weekday];
 if(duty.smile.split(', ').includes(day))lines.push('스마일 당번');
 const teacherId=teachers.find(t=>t.code===teacher)?.id;
 const own=new Set(classes.filter(c=>teacherId!=null&&c.teacher_id===teacherId&&c.starts_on<=date&&(!c.ends_on||c.ends_on>=date)).map(c=>String(c.id)));
 for(const event of events){
  if(event.deleted_at||event.event_date!==date)continue;
  if(!event.is_closure){lines.push(event.title);continue;}
  if(event.closure_all){lines.push(event.title+' · 전체 휴강');continue;}
  const ids=(event.closure_class_ids||[]).map(String).filter(id=>own.has(id));
  if(ids.length){const names=ids.map(id=>classes.find(c=>String(c.id)===id)?.name).filter(Boolean);lines.push(event.title+' · '+names.join(', ')+' 휴강');}
 }
 return [...new Set(lines)];
}

export function createDailyNotice({getState,readEvents,now=()=>new Date()}) {
 let sequence=0,timer;
 const el=document.createElement('section');el.id='dailyNotice';el.className='daily-notice';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');document.body.append(el);
 function hide(){clearTimeout(timer);el.hidden=true;el.innerHTML='';}
 async function show(){
  const request=++sequence;hide();
  const state=getState(),teacher=state.teacher,date=koreanToday(now());
  if(!state.ready)return;
  let events=[];try{events=await readEvents(date);}catch{/* 당번 안내는 일정 연결 실패와 관계없이 표시합니다. */}
  if(request!==sequence||getState().teacher!==teacher||!getState().ready||koreanToday(now())!==date||document.hidden)return;
  const lines=dailyLines({date,teacher,teachers:state.teachers,classes:state.classes,events});
  if(!lines.length)return;
  el.innerHTML='<strong class="daily-notice-title">오늘의 알림</strong><ul>'+lines.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>';
  el.hidden=false;timer=setTimeout(hide,7000);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){sequence++;hide();}else show();});
 window.addEventListener('pageshow',event=>{if(event.persisted)show();});
 return {show};
}
