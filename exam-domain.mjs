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
