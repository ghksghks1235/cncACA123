import {esc} from './domain.mjs?v=20261126-features1';
const labels=['11·19호','17·23호','27호','횡단보도'];
const assignments={
 '2026-09':{vehicle:['A','D','E','K'],smile:['SH','S','K']},
 '2026-10':{vehicle:['NA','S','SH','A'],smile:['D','NA','E']},
 '2026-11':{vehicle:['D','E','K','NA'],smile:['K','A','S']},
 '2026-12':{vehicle:['S','SH','A','D'],smile:['SH','E','NA']}
};
export function dutyFor(month,code){const a=assignments[month];return {vehicle:a?labels.filter((_,i)=>a.vehicle[i]===code).join(', ')||'없음':'미등록',smile:a?['월','화','목'].filter((_,i)=>a.smile[i]===code).map(d=>d+'요일').join(', ')||'없음':'미등록'}}
export function createDuties({teacher,modal}){
 const el=document.createElement('div');el.className='header-duties';document.querySelector('.teacher-switch').before(el);
 let month='';
 function render(){month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);const d=dutyFor(month,teacher());el.innerHTML=`<span class="duty-month">${Number(month.slice(5))}월 당번</span><button type="button" data-duty="vehicle">차량 <strong>${esc(d.vehicle)}</strong></button><button type="button" data-duty="smile">스마일 <strong>${esc(d.smile)}</strong></button>`;el.querySelectorAll('[data-duty]').forEach(b=>b.onclick=()=>{const kind=b.dataset.duty,a=assignments[month],names=kind==='vehicle'?labels:['월요일','화요일','목요일'];modal(`<h2>${Number(month.slice(5))}월 ${kind==='vehicle'?'차량':'스마일'}</h2>${a?`<table class="duty-table"><thead><tr><th>담당 ${kind==='vehicle'?'구역':'요일'}</th><th>선생님</th></tr></thead><tbody>${names.map((n,i)=>`<tr class="${a[kind][i]===teacher()?'my-duty':''}"><td>${n}</td><td>${esc(a[kind][i])}</td></tr>`).join('')}</tbody></table>`:'<p>이 달의 당번표가 아직 등록되지 않았어요.</p>'}<div class="actions"><button class="secondary" data-close>닫기</button></div>`)});}
 render();setInterval(render,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});return {render};
}
