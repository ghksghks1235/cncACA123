import {GROUPS,seatKey,validate} from './exam-domain.mjs?v=20261128-solver1';
const clone=x=>structuredClone(x);
const advanceId=s=>JSON.stringify([s.advanceClass,s.advanceTeacher]);
export function mixMetrics(plan){
 const students=new Map(plan.students.map(s=>[s.id,s]));let penalty=0,mixedColumns=0,maxTypes=0,seated403=0;const perColumn=[];
 for(const room of plan.rooms)room.columns.forEach((n,c)=>{const types=new Set();let count=0;for(let r=0;r<n;r++){const s=students.get(plan.seats[seatKey(room.id,c,r)]);if(s&&!s.absent){types.add(advanceId(s));count++;}}
  if(count){const extra=Math.max(0,types.size-1);penalty+=extra;mixedColumns+=Number(extra>0);maxTypes=Math.max(maxTypes,types.size);if(room.id==='403')seated403+=count;perColumn.push({room:room.id,column:c,types:types.size,count});}
 });
 return {penalty,mixedColumns,maxTypes,seated403,perColumn};
}
// Exact count-vector search with a time budget. Heuristic candidates are only
// incumbents; no beam width or capacity-only deduplication prunes the proof.
export function solveSeating(input,{timeLimitMs=14000,seed=Date.now(),onProgress=()=>{}}={}){
 const started=performance.now(),deadline=started+Math.max(1,timeLimitMs),plan=clone(input),students=plan.students.filter(s=>!s.absent);
 delete plan.optimization;
 if(new Set(plan.students.map(s=>s.id)).size!==plan.students.length)throw Error('학생 식별자가 중복되어 있어요. 명단을 다시 불러와주세요.');
 const groups=[...new Set(students.map(s=>s.group))];
 for(const s of students)if(GROUPS[s.group]!==s.grade)throw Error(s.name+': 창의 시험과 학년 정보가 맞지 않아요.');
 const buckets=[];const byKey=new Map();for(const s of students){const key=JSON.stringify([s.group,s.advanceClass,s.advanceTeacher]);if(!byKey.has(key)){byKey.set(key,buckets.length);buckets.push({group:s.group,grade:s.grade,students:[]});}buckets[byKey.get(key)].students.push(s);}
 const initial=buckets.map(b=>b.students.length),rooms=plan.rooms.filter(r=>r.enabled).sort((a,b)=>(a.id==='403'?-1:b.id==='403'?1:0)||a.id.localeCompare(b.id)),columns=rooms.flatMap(room=>room.columns.map((capacity,col)=>({room,col,capacity})));
 if(columns.some(c=>!Number.isInteger(c.capacity)||c.capacity<1||c.capacity>20))throw Error('강의실 좌석 수를 확인해주세요.');
 const totalCapacity=columns.reduce((n,c)=>n+c.capacity,0),has403=rooms.some(r=>r.id==='403'),orientations=has403?[6,5]:[0];
 let nodes=0,best=null,bestScore=null,proven=false,lowerBound=0,lastReport=-Infinity,randomState=seed>>>0,reason='';
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 function allowedGrade(index,orientation){const c=columns[index];return c.room.id==='403'?(c.col%2===0?orientation:11-orientation):0;}
 function score(candidate){const m=mixMetrics(candidate),check=validate(candidate),spread=new Map();for(const [key,id] of Object.entries(candidate.seats)){const s=candidate.students.find(x=>x.id===id),k=advanceId(s);if(!spread.has(k))spread.set(k,new Set());spread.get(k).add(key.split(':')[0]);}return [m.penalty,-m.seated403,[...spread.values()].reduce((n,s)=>n+s.size-1,0),check.teacherOverlap.length];}
 function better(a,b){if(!b)return true;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];return false;}
 function report(force=false){const now=performance.now();if(force||now-lastReport>=500){lastReport=now;onProgress({elapsedMs:Math.round(now-started),nodes,bestPenalty:bestScore?.[0]??null,lowerBound,plan:force&&best?clone(best):undefined});}}
 function materialize(allocations){
  const result=clone(plan);result.seats={};const available=buckets.map(b=>[...b.students]);
  allocations.forEach((allocation,i)=>{let row=0;const c=columns[i];for(const [bucket,count] of allocation||[]){
   // Within an identical paper/advance bucket, prefer students whose current
   // teacher is not supervising this room. This cannot change mixing cost.
   available[bucket].sort((a,b)=>Number(a.currentTeacher===c.room.teacher)-Number(b.currentTeacher===c.room.teacher)||a.name.localeCompare(b.name,'ko'));
   for(const s of available[bucket].splice(0,count))result.seats[seatKey(c.room.id,c.col,row++)]=s.id;
  }});return result;
 }
 function consider(allocations){const result=materialize(allocations),checked=validate(result,{complete:true});if(checked.errors.length)return;const value=score(result);if(better(value,bestScore)){best=result;bestScore=value;report(true);}}
 if(!students.length){best={...plan,seats:{}};bestScore=[0,0,0,0];proven=true;}
 if(students.length&&!validate(plan,{complete:true}).errors.length){
  const lookup=new Map(plan.students.map(s=>[s.id,s]));
  const valid403=orientations.some(o=>columns.every((c,i)=>c.room.id!=='403'||Array.from({length:c.capacity},(_,r)=>lookup.get(plan.seats[seatKey(c.room.id,c.col,r)])).filter(Boolean).every(s=>s.grade===allowedGrade(i,o))));
  if(valid403){best=clone(plan);compact(best);bestScore=score(best);}
 }
 if(totalCapacity<students.length){reason='사용 중인 강의실의 전체 좌석이 참석 인원보다 적어요.';return finish('infeasible');}
 const suffixCapacity=Array(columns.length+1).fill(0);for(let i=columns.length-1;i>=0;i--)suffixCapacity[i]=suffixCapacity[i+1]+columns[i].capacity;
 const groupBuckets=groups.map(group=>buckets.map((b,i)=>b.group===group?i:-1).filter(i=>i>=0));
 const groupGrade=groups.map(g=>GROUPS[g]);
 // Relaxed upper bound on seats available to a grade: adjacency is retained,
 // but demand of all other grades is unlimited. Cache by grade-presence mask.
 const gradeCache=new Map();
 function gradeCapacity(index,previous,orientation,mask,target){
  if(index===columns.length)return 0;const key=[index,previous,orientation,mask,target].join(':');if(gradeCache.has(key))return gradeCache.get(key);
  const c=columns[index],prev=index&&columns[index-1].room.id===c.room.id?previous:0,required=allowedGrade(index,orientation);
  let value=gradeCapacity(index+1,0,orientation,mask,target);
  for(const grade of [4,5,6])if((mask&(1<<(grade-4)))&&grade!==prev&&(!required||grade===required))value=Math.max(value,(grade===target?c.capacity:0)+gradeCapacity(index+1,grade,orientation,mask,target));
  gradeCache.set(key,value);return value;
 }
 function bounds(remaining,index,previous,orientation){
  const total=remaining.reduce((a,b)=>a+b,0);if(total>suffixCapacity[index])return null;
  const needs={4:0,5:0,6:0};remaining.forEach((n,b)=>needs[buckets[b].grade]+=n);let mask=0;for(const g of [4,5,6])if(needs[g])mask|=1<<(g-4);
  for(const grade of [4,5,6])if(needs[grade]>gradeCapacity(index,previous,orientation,mask,grade))return null;
  let exposures=0;
  for(let b=0;b<remaining.length;b++)if(remaining[b]){const caps=[];for(let j=index;j<columns.length;j++){const required=allowedGrade(j,orientation);if(!required||required===buckets[b].grade)caps.push(columns[j].capacity);}caps.sort((a,b)=>b-a);let covered=0,k=0;while(k<caps.length&&covered<remaining[b])covered+=caps[k++];if(covered<remaining[b])return null;exposures+=k;}
  return Math.max(0,exposures-(columns.length-index));
 }
 // Fast complete candidates. These never establish optimality; the exhaustive
 // phase below searches all legal quantities, including partially filled rows.
 const greedyEnd=Math.min(deadline,started+Math.min(350,timeLimitMs*.12));let attempts=0;
 while(!proven&&performance.now()<greedyEnd&&attempts++<2000){
  const orientation=orientations[attempts%orientations.length],remaining=[...initial],allocations=[];let previous=0;
  for(let i=0;i<columns.length;i++){
   const c=columns[i];if(!i||columns[i-1].room.id!==c.room.id)previous=0;const required=allowedGrade(i,orientation);
   const options=groups.map((g,j)=>({g,j,count:groupBuckets[j].reduce((n,b)=>n+remaining[b],0),tie:random()})).filter(x=>x.count&&groupGrade[x.j]!==previous&&(!required||groupGrade[x.j]===required)).sort((a,b)=>b.count-a.count||a.tie-b.tie);
   if(!options.length){allocations.push([]);previous=0;continue;}
   const chosen=options[Math.floor(random()*Math.min(options.length,attempts%3?2:1))],ids=groupBuckets[chosen.j].filter(b=>remaining[b]).sort((a,b)=>remaining[b]-remaining[a]||random()-.5),allocation=[];let left=c.capacity;
   for(const b of ids){const count=Math.min(left,remaining[b]);if(count){allocation.push([b,count]);remaining[b]-=count;left-=count;}if(!left)break;}
   allocations.push(allocation);previous=groupGrade[chosen.j];
  }
  if(remaining.every(n=>!n))consider(allocations);
 }
 const timeUp=()=>performance.now()>=deadline;
 // Enumerate every integer allocation of one creative group into one column.
 function* options(ids,remaining,capacity,maxExtra,minFill){
  const ordered=ids.filter(b=>remaining[b]).sort((a,b)=>remaining[b]-remaining[a]||a-b);
  for(const b of ordered)for(let count=Math.min(capacity,remaining[b]);count>=Math.max(1,minFill);count--)yield [[b,count]];
  if(maxExtra<1)return;
  function* distribute(at,left,parts){
   if(timeUp())return;if(!left){if(parts.length>=2)yield parts;return;}if(at>=ordered.length||parts.length>=maxExtra+1)return;
   const b=ordered[at],limit=Math.min(left,remaining[b]);
   for(let n=limit;n>=1;n--)yield* distribute(at+1,left-n,[...parts,[b,n]]);
   yield* distribute(at+1,left,parts);
  }
  for(let total=capacity;total>=Math.max(2,minFill);total--)yield* distribute(0,total,[]);
 }
 function search(budget,endTime){
  let timedOut=false,found=false;const failed=new Set();
  for(const orientation of orientations){const remaining=[...initial],allocations=[];
   function visit(index,previous,left){
    nodes++;if(performance.now()>=endTime){timedOut=true;return false;}if(!(nodes%512))report();
    const total=remaining.reduce((a,b)=>a+b,0);if(!total){consider(allocations);found=true;return true;}if(index===columns.length)return false;
    const c=columns[index];if(!index||columns[index-1].room.id!==c.room.id)previous=0;
    const bound=bounds(remaining,index,previous,orientation);if(bound===null||bound>left)return false;
    const key=[orientation,index,previous,left,...remaining].join(',');if(failed.has(key))return false;
    const required=allowedGrade(index,orientation),minFill=Math.max(0,total-suffixCapacity[index+1]);
    const choices=groups.map((g,j)=>({j,count:groupBuckets[j].reduce((n,b)=>n+remaining[b],0)})).filter(x=>x.count&&groupGrade[x.j]!==previous&&(!required||groupGrade[x.j]===required)).sort((a,b)=>b.count-a.count||a.j-b.j);
    for(const {j} of choices)for(const allocation of options(groupBuckets[j],remaining,c.capacity,left,minFill)){
     const extra=allocation.length-1;if(extra>left)continue;for(const [b,n] of allocation)remaining[b]-=n;allocations[index]=allocation;
     const ok=visit(index+1,groupGrade[j],left-extra);for(const [b,n] of allocation)remaining[b]+=n;allocations.length=index;if(ok)return true;if(timedOut)return false;
    }
    if(!minFill){allocations[index]=[];if(visit(index+1,0,left))return true;allocations.length=index;if(timedOut)return false;}
    // A timeout is never memoized as an impossible state.
    if(!timeUp()){if(failed.size<250000)failed.add(key);}else timedOut=true;
    return false;
   }
   visit(0,0,budget);if(found||timedOut)break;
  }
  return {found,complete:!timedOut};
 }
 if(!proven&&!best){const initialSearch=search(students.length,deadline);if(initialSearch.complete&&!initialSearch.found){reason='지정한 강의실과 학년 교대·창의 시험 조건으로는 전원 배치할 수 없어요.';return finish('infeasible');}}
 if(bestScore?.[0]===0){proven=true;lowerBound=0;}
 if(best&&!proven){
  const boundsAtRoot=orientations.map(o=>bounds(initial,0,0,o)).filter(x=>x!==null);lowerBound=boundsAtRoot.length?Math.min(...boundsAtRoot):0;
  while(!timeUp()&&lowerBound<bestScore[0]){const checked=search(lowerBound,deadline);if(checked.found){proven=true;lowerBound=bestScore[0];break;}if(!checked.complete)break;lowerBound++;}
  if(lowerBound>=bestScore[0])proven=true;
 }
 if(best)improveSecondary(best);
 if(best&&mixMetrics(best).penalty===0){proven=true;lowerBound=0;}
 return finish(best?(proven?'optimal':'best_found'):'no_solution_found');
 function improveSecondary(candidate){
  // Empty back seats in 403 may be filled from the same advance bucket without
  // increasing the primary mixing penalty. Other students remain compacted.
  const lookup=new Map(candidate.students.map(s=>[s.id,s]));let changed=true;
  while(changed&&!timeUp()){changed=false;const before=score(candidate);
   const room=candidate.rooms.find(r=>r.id==='403'&&r.enabled);if(!room)break;
   outer:for(let c=0;c<room.columns.length;c++){const target=Array.from({length:room.columns[c]},(_,r)=>lookup.get(candidate.seats[seatKey('403',c,r)])).filter(Boolean);if(!target.length||target.length===room.columns[c])continue;
    for(const [key,id] of Object.entries(candidate.seats)){const s=lookup.get(id);if(key.startsWith('403:')||s.group!==target[0].group)continue;const next=clone(candidate);delete next.seats[key];next.seats[seatKey('403',c,target.length)]=id;
     compact(next);if(!validate(next,{complete:true}).errors.length&&better(score(next),before)){candidate.seats=next.seats;changed=true;break outer;}
    }
   }
  }
  // Exchange whole columns of the same creative paper. This preserves the
  // primary score and grade alternation while improving lower-priority ties.
  changed=true;
  while(changed&&!timeUp()){
   changed=false;const before=score(candidate),entries=[];
   for(const room of candidate.rooms.filter(r=>r.enabled))room.columns.forEach((capacity,c)=>{const ids=Array.from({length:capacity},(_,r)=>candidate.seats[seatKey(room.id,c,r)]).filter(Boolean);if(ids.length)entries.push({room,c,capacity,ids,group:lookup.get(ids[0]).group});});
   outer:for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
    if(timeUp())break outer;const x=entries[a],y=entries[b];if(x.group!==y.group||x.ids.length>y.capacity||y.ids.length>x.capacity)continue;
    const next=clone(candidate);for(let r=0;r<x.capacity;r++)delete next.seats[seatKey(x.room.id,x.c,r)];for(let r=0;r<y.capacity;r++)delete next.seats[seatKey(y.room.id,y.c,r)];
    y.ids.forEach((id,r)=>next.seats[seatKey(x.room.id,x.c,r)]=id);x.ids.forEach((id,r)=>next.seats[seatKey(y.room.id,y.c,r)]=id);
    if(better(score(next),before)){candidate.seats=next.seats;changed=true;break outer;}
   }
  }
 }
 function compact(candidate){for(const room of candidate.rooms)room.columns.forEach((n,c)=>{const ids=[];for(let r=0;r<n;r++){const key=seatKey(room.id,c,r);if(candidate.seats[key])ids.push(candidate.seats[key]);delete candidate.seats[key];}ids.forEach((id,r)=>candidate.seats[seatKey(room.id,c,r)]=id);});}
 function finish(status){
  if(best){const metrics=mixMetrics(best);best.optimization={algorithm:'count-search-v2',status,certifiedMix:status==='optimal'?metrics.penalty:null,lowerBound:Math.min(lowerBound,metrics.penalty),nodes,elapsedMs:Math.round(performance.now()-started),metrics,scope:'필수 규칙·전원 배치·403호 6/5학년 교대 조건에서 선행반 섞임 합계',secondaryProven:false};}
  return {plan:best,status,reason,lowerBound:best?Math.min(lowerBound,mixMetrics(best).penalty):lowerBound,nodes,elapsedMs:Math.round(performance.now()-started)};
 }
}
