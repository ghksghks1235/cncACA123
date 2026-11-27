export const ROOMS=[['401',[5,5,4],'NA'],['402',[5,4,4],'K'],['404',[5,4,4],'D'],['405',[5,4,5],'S'],['406',[5,4,5],'A'],['407',[5,4,4],'E'],['403',[6,7,7,7,7,7],'SH'],['408',[5,5,4],'']].map(([id,columns,teacher])=>({id,columns,teacher,enabled:id!=='408'}));
export const GROUPS={'6영재':6,'5영재':5,'고급':6,'중급':5,'입문':4,'초급':4};
const CLASS_NAMES=['6영재','6MS1','6MS2','6MS3','6TS0','6TS1','6TS2','6TS3','5MS1','5MS2','5TS1','5TS2','4MS1','4TS1'];
const COLORS=['#f5d5df','#d8e8ff','#d5eee5','#e5ddfa','#f9e2c9','#d4edf3','#f3dbed','#e0e7c8','#fff0bc','#d4e3ed','#e8dbcc','#dcdef8','#f5ddc8','#d9ebd0'];
export const classColor=name=>COLORS[Math.max(0,CLASS_NAMES.indexOf(name))%COLORS.length];
export const seatKey=(room,col,row)=>`${room}:${col}:${row}`;
export const defaultRooms=()=>structuredClone(ROOMS);
export const creativeGroup=(name,fourth='입문')=>name==='6영재'?'6영재':name==='5MS1'?'5영재':name.startsWith('6')?'고급':name.startsWith('5')?'중급':fourth;
const normalized=name=>String(name||'').normalize('NFC').trim();
export function buildRoster(documents,date,day,fourth='입문'){
 const current=new Map(),advance=new Map(),issues=[],sheets={현행:0,선행:0};
 for(const {sheet,rows} of documents){
  const type=sheet.slot===day+' 현행'?'현행':sheet.slot===day+' 선행'?'선행':null;if(!type)continue;sheets[type]++;
  for(const row of rows){const name=normalized(row.student_name);if(!name||row.deleted_at||(row.starts_on&&row.starts_on>date)||(row.ends_on&&row.ends_on<date))continue;
   const map=type==='현행'?current:advance;if(!map.has(name))map.set(name,[]);map.get(name).push({sheet,row});
  }
 }
 if(!sheets.현행||!sheets.선행)issues.push(`${day} ${!sheets.현행?'현행':'선행'} 출석부가 없어요. 해당 월 명단을 먼저 준비해주세요.`);
 const students=[];
 for(const name of new Set([...current.keys(),...advance.keys()])){
  const a=current.get(name)||[],b=advance.get(name)||[];
  for(const [kind,items] of [['현행',a],['선행',b]])if(items.length!==1)issues.push(`${name}: ${kind} ${items.length?'중복 — '+items.map(x=>x.sheet.class_name+'('+x.sheet.teacher_code+')').join(', '):'명단 누락'}`);
  if(a.length!==1||b.length!==1)continue;
  const c=a[0].sheet,s=b[0].sheet,grade=Number(c.class_name.slice(0,1));
  if(![4,5,6].includes(grade)){issues.push(`${name}: 현행반 ${c.class_name}의 학년을 확인해주세요.`);continue;}
  students.push({id:String(a[0].row.id),name,grade,currentClass:c.class_name,currentTeacher:c.teacher_code,advanceClass:s.class_name,advanceTeacher:s.teacher_code,advanceKey:String(s.class_id),group:creativeGroup(c.class_name,fourth),absent:false});
 }
 return {students:students.sort((a,b)=>a.currentClass.localeCompare(b.currentClass,'ko',{numeric:true})||a.name.localeCompare(b.name,'ko')),issues};
}
export function validate(plan,{complete=false}={}){
 const errors=[],students=new Map(plan.students.map(s=>[s.id,s])),seen=new Set(),labels={};
 for(const room of plan.rooms){let lastGrade=null;
  room.columns.forEach((n,c)=>{const occupants=[];
   for(let r=0;r<n;r++){const key=seatKey(room.id,c,r),id=plan.seats[key];if(!id)continue;const s=students.get(id);
    if(!s){errors.push('명단에 없는 학생이 배치되어 있어요.');continue;}if(seen.has(id))errors.push(s.name+': 중복 배치');seen.add(id);
    if(!room.enabled)errors.push(room.id+'호는 사용하지 않는 강의실이에요.');if(s.absent)errors.push(s.name+': 불참 학생이 배치되어 있어요.');occupants.push(s);
   }
   if(!occupants.length){lastGrade=null;return;}const group=occupants[0].group;labels[room.id+':'+c]=group;
   if(occupants.some(s=>s.group!==group))errors.push(`${room.id}호 ${c+1}열: 창의 시험지가 달라요.`);
   const grade=occupants[0].grade;if(lastGrade===grade)errors.push(`${room.id}호: 인접한 세로줄의 학년이 같아요.`);lastGrade=grade;
  });
 }
 const keys=new Set(plan.rooms.flatMap(room=>room.columns.flatMap((n,c)=>Array.from({length:n},(_,r)=>seatKey(room.id,c,r)))));
 for(const key of Object.keys(plan.seats))if(plan.seats[key]&&!keys.has(key))errors.push('존재하지 않는 좌석에 배치되어 있어요.');
 if(complete)for(const s of plan.students)if(!s.absent&&!seen.has(s.id))errors.push(s.name+': 미배치');
 return {errors:[...new Set(errors)],labels,seated:seen.size,unplaced:plan.students.filter(s=>!s.absent&&!seen.has(s.id)),teacherOverlap:plan.students.filter(s=>seen.has(s.id)&&plan.rooms.some(room=>room.enabled&&room.teacher===s.currentTeacher&&Object.entries(plan.seats).some(([k,id])=>id===s.id&&k.startsWith(room.id+':'))))};
}
export function moveStudent(plan,id,target){
 const next=structuredClone(plan),student=next.students.find(s=>s.id===id);if(!student)throw Error('학생을 찾을 수 없어요.');
 const from=Object.keys(next.seats).find(k=>next.seats[k]===id),other=target?next.seats[target]:null;
 if(from)delete next.seats[from];if(target){student.absent=false;next.seats[target]=id;if(other&&other!==id&&from)next.seats[from]=other;}
 const result=validate(next);if(result.errors.length)throw Error(result.errors[0]);return next;
}
export function paperCounts(plan,roomId=null){
 const ids=new Set(Object.entries(plan.seats).filter(([key])=>!roomId||key.startsWith(roomId+':')).map(([,id])=>id));const counts=[new Map(),new Map(),new Map(),new Map()];
 for(const s of plan.students){if(s.absent||!ids.has(s.id))continue;[s.grade+'현행',s.grade+'경시',s.group,s.advanceClass+'('+s.advanceTeacher+')'].forEach((name,i)=>counts[i].set(name,(counts[i].get(name)||0)+1));}
 return counts.map(c=>[...c].sort(([a],[b])=>a.localeCompare(b,'ko',{numeric:true})));
}
function patterns(room,groups){const out=[];function visit(a,last){out.push([...a,...Array(room.columns.length-a.length).fill(null)]);if(a.length===room.columns.length)return;for(const g of groups)if(GROUPS[g]!==last)visit([...a,g],GROUPS[g]);}visit([],null);return out;}
function arrange(plan,layouts,random){
 const next=structuredClone(plan);next.seats={};let score=0;
 const groups=[...new Set(next.students.filter(s=>!s.absent).map(s=>s.group))];
 for(const group of groups){
  const columns=next.rooms.filter(r=>r.enabled).flatMap(room=>room.columns.map((n,c)=>({room,col:c,capacity:n,left:n,students:[]}))).filter(c=>layouts[c.room.id]?.[c.col]===group);
  const buckets=new Map();for(const s of next.students.filter(s=>!s.absent&&s.group===group)){if(!buckets.has(s.advanceKey))buckets.set(s.advanceKey,[]);buckets.get(s.advanceKey).push(s);}
  const ordered=[...buckets.values()].sort((a,b)=>b.length-a.length||random()-.5);
  for(const bucket of ordered){const usedColumns=new Set(),usedRooms=new Set();let remaining=[...bucket];
   while(remaining.length){const available=columns.filter(c=>c.left);if(!available.length){score+=remaining.length*1e7;break;}
    available.sort((a,b)=>{const cost=c=>(c.left>=remaining.length?0:10000)+(usedColumns.size&&!usedColumns.has(c.room.id+':'+c.col)?1000:0)+(usedRooms.size&&!usedRooms.has(c.room.id)?100:0)+(c.room.teacher===remaining[0].currentTeacher?1:0)+(c.left>=remaining.length?c.left-remaining.length:-c.left);return cost(a)-cost(b)||random()-.5;});
    const c=available[0],take=remaining.splice(0,c.left);c.students.push(...take);c.left-=take.length;usedColumns.add(c.room.id+':'+c.col);usedRooms.add(c.room.id);
   }
   score+=Math.max(0,usedColumns.size-1)*10000+Math.max(0,usedRooms.size-1)*1000;
  }
  for(const c of columns)c.students.forEach((s,r)=>{next.seats[seatKey(c.room.id,c.col,r)]=s.id;if(s.currentTeacher===c.room.teacher)score++;});
 }
 // Teacher overlap is improved only when the advance grouping remains unchanged.
 let improved=true;while(improved){improved=false;const entries=Object.entries(next.seats);outer:for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const [ka,ia]=entries[i],[kb,ib]=entries[j],a=next.students.find(s=>s.id===ia),b=next.students.find(s=>s.id===ib);if(a.advanceKey!==b.advanceKey||a.group!==b.group)continue;
  const ta=next.rooms.find(r=>r.id===ka.split(':')[0]).teacher,tb=next.rooms.find(r=>r.id===kb.split(':')[0]).teacher;
  const before=Number(a.currentTeacher===ta)+Number(b.currentTeacher===tb),after=Number(a.currentTeacher===tb)+Number(b.currentTeacher===ta);
  if(after<before){next.seats[ka]=ib;next.seats[kb]=ia;score+=after-before;improved=true;break outer;}
 }}
 return {plan:next,score};
}
export function autoPlace(plan,seed=Date.now()){
 let v=seed>>>0;const random=()=>{v=(Math.imul(1664525,v)+1013904223)>>>0;return v/4294967296;};
 const students=plan.students.filter(s=>!s.absent),groups=[...new Set(students.map(s=>s.group))];if(!groups.length)return {...structuredClone(plan),seats:{}};
 const demand=groups.map(g=>students.filter(s=>s.group===g).length),rooms=plan.rooms.filter(r=>r.enabled).sort((a,b)=>b.columns.length-a.columns.length||a.id.localeCompare(b.id));
 if(!rooms.length)return {...structuredClone(plan),seats:{}};
 // Beam search assigns a single creative paper to each physical column first.
 let beam=[{caps:groups.map(()=>0),layouts:{},score:0}];
 for(const room of rooms){
  const options=patterns(room,groups).map(labels=>({labels,caps:groups.map(g=>labels.reduce((n,l,c)=>n+(l===g?room.columns[c]:0),0))}));
  // A single-grade exam may use separated physical columns, never adjacent columns.
  if(!options.length)options.push({labels:room.columns.map((_,c)=>c%2===0?groups[0]:null),caps:groups.map((g,i)=>i?0:room.columns.reduce((n,x,c)=>n+(c%2===0?x:0),0))});
  const candidates=new Map();
  for(const prev of beam)for(const opt of options){const caps=prev.caps.map((n,i)=>n+opt.caps[i]);const deficit=demand.reduce((n,d,i)=>n+Math.max(0,d-caps[i]),0),waste=demand.reduce((n,d,i)=>n+Math.max(0,caps[i]-d),0);
   const score=deficit*1000+waste*2+random()*.1,key=caps.map((n,i)=>Math.min(n,demand[i]+7)).join(',');
   const candidate={caps,layouts:{...prev.layouts,[room.id]:opt.labels},score};if(!candidates.has(key)||candidates.get(key).score>score)candidates.set(key,candidate);
  }
  beam=[...candidates.values()].sort((a,b)=>a.score-b.score).slice(0,140);
 }
 let best=null;for(const candidate of beam.slice(0,30))for(let attempt=0;attempt<4;attempt++){const result=arrange(plan,candidate.layouts,random);const check=validate(result.plan);if(check.errors.length)continue;if(!best||result.score<best.score)best=result;}
 return best?.plan||{...structuredClone(plan),seats:{}};
}
