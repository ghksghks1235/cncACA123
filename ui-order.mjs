export const TEACHER_ORDER=['A','D','SH','NA','E','K','S'];
export const CLASS_ORDER={월수:['6영재','6MS1','6MS2','6MS3','5MS1','5MS2','4MS1'],화목:['6TS0','6TS1','6TS2','6TS3','5TS1','5TS2','4TS1']};
const rank=(list,value)=>{const i=list.indexOf(value);return i<0?list.length:i};
export function sortTeachers(teachers){return [...teachers].sort((a,b)=>rank(TEACHER_ORDER,a.code)-rank(TEACHER_ORDER,b.code)||a.code.localeCompare(b.code,'ko'));}
export const ADVANCE_ORDER={월수:['3-1진도','2-1심화','2-1진도','1-1응용','1-1진도','6응용','4-2진도'],화목:['2-1진도','1-1응용','1-1진도','6-2응용','6-1응용','5-2진도','4-2진도']};
export function sortProgressClasses(classes,allClasses,day,month){
 const classRank=c=>rank((c.slot.endsWith('현행')?CLASS_ORDER:ADVANCE_ORDER)[day]||[],c.name);
 return [...classes].sort((a,b)=>classRank(a)-classRank(b)||a.name.localeCompare(b.name,'ko',{numeric:true})||Number(a.id)-Number(b.id));
}
