import assert from 'node:assert/strict';
import {solveSeating,mixMetrics} from '../exam-solver.mjs';
import {defaultRooms,validate,seatKey} from '../exam-domain.mjs';
function students(spec){let id=0;return spec.flatMap(([group,advance,count,teacher='K'])=>Array.from({length:count},()=>({id:String(++id),name:'가상'+id,grade:{고급:6,'6영재':6,중급:5,'5영재':5,입문:4}[group],group,currentClass:group,currentTeacher:'SH',advanceClass:advance,advanceTeacher:teacher,advanceKey:advance+teacher,absent:false})));}
const make=(spec,columns=[3,3,3])=>({rooms:[{id:'401',columns,teacher:'SH',enabled:true}],students:students(spec),seats:{}});
// Independent individual-student subset oracle for tiny classrooms. Does not
// use the solver's count-vector search, bounds, or memoization.
function oracle(plan){const ss=plan.students.filter(s=>!s.absent),cols=plan.rooms.filter(r=>r.enabled).flatMap(room=>room.columns.map((cap,c)=>({room,c,cap})));let best=Infinity;
 function visit(i,mask,last,cost){if(mask===(1<<ss.length)-1){best=Math.min(best,cost);return;}if(i===cols.length||cost>=best)return;const col=cols[i],prev=i&&cols[i-1].room.id===col.room.id?last:0;
  visit(i+1,mask,0,cost);const free=ss.map((s,j)=>!(mask&(1<<j))?j:-1).filter(j=>j>=0);
  for(let subset=1;subset<(1<<free.length);subset++){const ids=free.filter((j,k)=>subset&(1<<k));if(ids.length>col.cap)continue;const first=ss[ids[0]];if(first.grade===prev||ids.some(j=>ss[j].group!==first.group))continue;
   const types=new Set(ids.map(j=>ss[j].advanceClass+'|'+ss[j].advanceTeacher));const nextMask=ids.reduce((m,j)=>m|(1<<j),mask);visit(i+1,nextMask,first.grade,cost+types.size-1);
  }
 }visit(0,0,0,0);return best;
}
const cases=[make([['고급','a',2],['고급','b',1],['중급','c',2]],[3,2]),make([['고급','a',2],['고급','b',2],['중급','c',1]],[2,1,2]),make([['고급','a',3],['고급','b',1],['중급','c',2]],[3,2,2]),make([['6영재','a',2],['고급','b',2]],[2,2]),make([['입문','a',1],['중급','b',1],['고급','c',2]],[2,1,2]),make([['고급','a',1,'K'],['고급','a',1,'S'],['중급','b',1]],[2,1])];
for(let k=0;k<30;k++){const p=make([['고급','a',1+k%2],['고급','b',1],['중급','c',1+(k%3===0?1:0)],['입문','d',k%2]],[1+k%3,1+(k+1)%3,1+(k+2)%3]);cases.push(p);}
for(const [i,p] of cases.entries()){const expected=oracle(p),r=solveSeating(p,{timeLimitMs:3000,seed:i});if(expected===Infinity){assert.equal(r.status,'infeasible','case '+i);assert.equal(r.plan,null);}else{assert.equal(r.status,'optimal','case '+i);assert.equal(mixMetrics(r.plan).penalty,expected,'case '+i);assert.deepEqual(validate(r.plan,{complete:true}).errors,[]);}}
console.log('36 tiny cases match exhaustive individual-student oracle, including proven infeasibility.');
// 15 grade-6 students in five groups of 3 must fill the three 5-seat
// columns. Two one-seat grade-5 columns separate them. Five incidences
// cannot fit (3+3>5); six incidences would require four unsplit 3s to
// share three bins, also impossible. Seven incidences attain cost 4.
const forced=make([['고급','a',3],['고급','b',3],['고급','c',3],['고급','d',3],['고급','e',3],['중급','f',2]],[5,1,5,1,5]);
const forcedResult=solveSeating(forced,{timeLimitMs:5000,seed:7});assert.equal(forcedResult.status,'optimal');assert.equal(mixMetrics(forcedResult.plan).penalty,4);console.log('Nonzero optimum independently derived: 4 points, certified by search.');
const specs=[['6영재','a',16],['고급','b',16],['고급','c',16],['고급','d',16],['5영재','e',16],['중급','f',16],['입문','g',12]];
const large={rooms:defaultRooms(),students:students(specs),seats:{}};let r=solveSeating(large,{timeLimitMs:2000,seed:123});assert(r.plan);assert.deepEqual(validate(r.plan,{complete:true}).errors,[]);const m=mixMetrics(r.plan);assert.equal(r.status==='optimal',m.penalty===0||r.plan.optimization.certifiedMix===m.penalty);console.log('108 students:',r.status,m.penalty+' mixing',m.seated403+' in 403',r.elapsedMs+'ms');
const lookup=new Map(r.plan.students.map(s=>[s.id,s]));const grades=r.plan.rooms.find(x=>x.id==='403').columns.map((n,c)=>Array.from({length:n},(_,row)=>lookup.get(r.plan.seats[seatKey('403',c,row)])).filter(Boolean).map(s=>s.grade));assert(grades.every((g,i)=>g.every(n=>n===(i%2?5:6)))||grades.every((g,i)=>g.every(n=>n===(i%2?6:5))));
const current=structuredClone(r.plan);r=solveSeating(current,{timeLimitMs:10,seed:9});assert(r.plan);assert(mixMetrics(r.plan).penalty<=mixMetrics(current).penalty);
const absent=make([['고급','a',2],['중급','b',1]],[2,1]);absent.students[0].absent=true;r=solveSeating(absent,{timeLimitMs:1000});assert(!Object.values(r.plan.seats).includes(absent.students[0].id));
const overload=make([['고급','a',6]],[1,1]);r=solveSeating(overload,{timeLimitMs:100});assert.equal(r.status,'infeasible');
const many={rooms:defaultRooms(),students:students([['고급','a',90],['중급','b',8],['입문','c',8]]),seats:{}};r=solveSeating(many,{timeLimitMs:10});assert(!r.plan||!validate(r.plan,{complete:true}).errors.length);assert(['infeasible','no_solution_found','best_found','optimal'].includes(r.status));
const empty={rooms:defaultRooms(),students:[],seats:{}};r=solveSeating(empty,{timeLimitMs:100});assert.equal(r.status,'optimal');
console.log('Absence, current incumbent, capacity, timeout status, 403 grade rules, and empty roster passed.');
