import {classColor,seatKey,validate} from './exam-domain.mjs?v=20261127-exam1';
const encoder=new TextEncoder();
// A self-contained one-page PDF. Rasterized at 240dpi so Korean system fonts
// are embedded in the page image, with no external font/CDN dependency.
export function jpegPdf(jpeg,width,height){
 const chunks=[],offsets=[0];let size=0;const add=x=>{const b=typeof x==='string'?encoder.encode(x):x;chunks.push(b);size+=b.length;};
 add('%PDF-1.4\n');const obj=(id,body)=>{offsets[id]=size;add(id+' 0 obj\n'+body+'\nendobj\n');};
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=size;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);add(jpeg);add('\nendstream\nendobj\n');
 const stream='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';obj(5,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
 const start=size;add('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
}
export async function roomPdf(document,day,roomId){
 await globalThis.document.fonts.ready;
 const plan=document.days[day],room=plan.rooms.find(r=>r.id===roomId);if(!room?.enabled)throw Error('사용 중인 강의실을 선택해주세요.');
 const canvas=globalThis.document.createElement('canvas');canvas.width=2806;canvas.height=1984;
 const ctx=canvas.getContext('2d');ctx.scale(2.5,2.5);const W=canvas.width/2.5,H=canvas.height/2.5;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.textBaseline='middle';ctx.textAlign='center';
 const text=(value,x,y,size=18,bold=false,max=1000)=>{ctx.fillStyle='#182337';let n=size;do{ctx.font=`${bold?'700':'400'} ${n}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;if(ctx.measureText(value).width<=max)break;n--;}while(n>10);ctx.fillText(value,x,y);};
 text(`${room.id}호 · ${day}반`,W/2,42,30,true);text(`${document.title}  |  ${document.dates[day]}`,W/2,78,16,false,W-100);
 ctx.fillStyle='#eef1f6';ctx.fillRect(W*.35,105,W*.3,26);text('칠 판',W/2,118,15,true);
 const margin=28,gap=16,colW=(W-margin*2-gap*(room.columns.length-1))/room.columns.length,top=155,rowH=Math.min(73,(H-top-35)/Math.max(...room.columns));
 const lookup=new Map(plan.students.map(s=>[s.id,s])),labels=validate(plan).labels;
 room.columns.forEach((count,c)=>{const x=margin+c*(colW+gap);text(labels[room.id+':'+c]||'빈 줄',x+colW/2,top,19,true,colW-8);
  for(let r=0;r<count;r++){const y=top+25+r*rowH,s=lookup.get(plan.seats[seatKey(room.id,c,r)]);ctx.fillStyle=s?classColor(s.currentClass):'#fff';ctx.fillRect(x,y,colW,rowH-5);ctx.strokeStyle='#657084';ctx.lineWidth=.8;ctx.strokeRect(x,y,colW,rowH-5);
   if(s){const nameW=colW*.49;text(s.name,x+nameW/2,y+(rowH-5)/2,20,true,nameW-10);ctx.strokeStyle='#a1a9b6';ctx.beginPath();ctx.moveTo(x+nameW,y);ctx.lineTo(x+nameW,y+rowH-5);ctx.stroke();text(s.advanceClass,x+nameW+(colW-nameW)/2,y+(rowH-5)/2,16,false,colW-nameW-8);}
  }
 });
 // Only student names and advance class names are drawn. Teacher codes and
 // paper counts never enter the PDF canvas or metadata.
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));if(!blob)throw Error('PDF 이미지를 만들지 못했어요.');
 return jpegPdf(new Uint8Array(await blob.arrayBuffer()),canvas.width,canvas.height);
}
