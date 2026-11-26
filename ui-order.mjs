export const TEACHER_ORDER=['A','D','SH','NA','E','K','S'];
export const CLASS_ORDER={월수:['6영재','6MS1','6MS2','6MS3','5MS1','5MS2','4MS1'],화목:['6TS0','6TS1','6TS2','6TS3','5TS1','5TS2','4TS1']};
const rank=(list,value)=>{const i=list.indexOf(value);return i<0?list.length:i};
export function sortTeachers(teachers){return [...teachers].sort((a,b)=>rank(TEACHER_ORDER,a.code)-rank(TEACHER_ORDER,b.code)||a.code.localeCompare(b.code,'ko'));}
export function sortProgressClasses(classes,allClasses,day,month){
 const order=CLASS_ORDER[day]||[];
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 const mainRanks=new Map();
 for(const c of allClasses){if(c.slot!==day+' 현행'||c.starts_on>end||(c.ends_on&&c.ends_on<month+'-01'))continue;const r=rank(order,c.name);mainRanks.set(c.teacher_id,Math.min(mainRanks.get(c.teacher_id)??order.length,r));}
 const classRank=c=>c.slot.endsWith('현행')?rank(order,c.name):(mainRanks.get(c.teacher_id)??order.length);
 return [...classes].sort((a,b)=>classRank(a)-classRank(b)||a.name.localeCompare(b.name,'ko',{numeric:true})||Number(a.id)-Number(b.id));
}
