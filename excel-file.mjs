// Small OOXML workbook writer. Stored ZIP entries keep downloads independent of CDNs.
const encoder=new TextEncoder();
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const prolog='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function column(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
const cell=(r,c,value,style=0)=>`<c r="${column(c)}${r}" s="${style}"${typeof value==='number'?'':' t="inlineStr"'}>${typeof value==='number'?'<v>'+value+'</v>':'<is><t xml:space="preserve">'+xml(value)+'</t></is>'}</c>`;
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){
 const parts=[],central=[];let offset=0,centralSize=0;
 for(const [name,content] of files){const n=encoder.encode(name),data=encoder.encode(content),crc=crc32(data),local=new Uint8Array(30+n.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);local.set(n,30);parts.push(local,data);
  const cd=new Uint8Array(46+n.length),d=new DataView(cd.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);cd.set(n,46);central.push(cd);centralSize+=cd.length;offset+=local.length+data.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const out=new Uint8Array(offset+centralSize+22);let at=0;for(const p of [...parts,...central,end]){out.set(p,at);at+=p.length;}return out;
}
function styles(){
 const fonts=[['344563',11,false],['233D6B',17,true],['7A879A',10,false],['516887',11,true],['344563',11,true],['7B879C',11,false],['B94360',11,true],['9A6C16',11,true],['7F899B',10,false],['8A7181',10,true]];
 const fills=['FFFFFF','ECF1FA','F8FAFD','FDECF0','FFF4D5','F0F2F6'];
 // font, fill, border, numFmt, horizontal alignment
 const defs=[[0,0,0,0,'left'],[1,0,0,0,'left'],[2,0,0,0,'left'],[3,1,1,0,'center'],[3,1,1,164,'center'],[5,0,1,0,'center'],[5,2,1,0,'center'],[4,0,1,0,'center'],[4,2,1,0,'center'],[6,3,1,0,'center'],[7,4,1,0,'center'],[8,5,1,0,'center'],[9,5,1,0,'center']];
 return prolog+`<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="m/d"/></numFmts><fonts count="${fonts.length}">${fonts.map(([color,size,bold])=>`<font>${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="맑은 고딕"/><family val="2"/></font>`).join('')}</fonts><fills count="${fills.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${['left','right','top','bottom'].map(e=>`<${e} style="thin"><color rgb="FFDCE3ED"/></${e}>`).join('')}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${defs.length}">${defs.map(([font,fill,border,num,align])=>`<xf numFmtId="${num}" fontId="${font}" fillId="${fill+2}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${num?' applyNumberFormat="1"':''}><alignment horizontal="${align}" vertical="center" wrapText="${font===4?1:0}"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function sheetXML(sheet){
 const last=column(sheet.dates.length+2),lastRow=6+Math.max(sheet.rows.length,1),rows=[];
 const row=(n,height,cells)=>`<row r="${n}" ht="${height}" customHeight="1">${cells}</row>`;
 rows.push(row(1,10,''),row(2,34,cell(2,0,'씨앤씨 월별 출석부',1)),row(3,25,cell(3,0,sheet.subtitle,2)),row(4,10,''));
 const header=['번호','학생 이름','차량'];let h=header.map((v,i)=>cell(5,i,v,3)).join(''),week=header.map((_,i)=>cell(6,i,'',3)).join('');
 sheet.dates.forEach((date,i)=>{const serial=Math.round(Date.parse(date+'T00:00:00Z')/86400000)+25569;h+=cell(5,i+3,serial,4);week+=cell(6,i+3,['일','월','화','수','목','금','토'][new Date(date+'T12:00:00Z').getUTCDay()],3);});
 rows.push(row(5,23,h),row(6,20,week));
 const data=sheet.rows.length?sheet.rows:[['','','',...sheet.dates.map(()=>'')]];
 data.forEach((values,i)=>{const n=i+7;rows.push(row(n,String(values[1]).includes('\n')?33:23,values.map((value,c)=>{let s=i%2?6:5;if(c===1)s=i%2?8:7;else if(c>=3){if(value==='×')s=9;else if(value==='지각'||value==='조퇴')s=10;else if(value==='휴강'||value==='—')s=11;else if(value==='퇴원')s=12;}return cell(n,c,value,s)}).join('')));});
 rows.push(row(lastRow+2,23,cell(lastRow+2,0,'○ 출석    × 결석    지각·조퇴    빈칸 미입력',2)));
 const merges=[`A2:${last}2`,`A3:${last}3`,'A5:A6','B5:B6','C5:C6',`A${lastRow+2}:${last}${lastRow+2}`];
 return prolog+`<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${lastRow+2}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="3" ySplit="6" topLeftCell="D7" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="D7" sqref="D7"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="23"/><cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="8" customWidth="1"/><col min="4" max="${sheet.dates.length+3}" width="9" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${sheet.rows.length<=22?1:0}"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
}
export function buildXlsx(sheets){
 if(!sheets.length)throw Error('다운로드할 반이 없어요.');
 const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const files=[['[Content_Types].xml',prolog+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels',prolog+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',prolog+`<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,i)=>`<definedName name="_xlnm.Print_Area" localSheetId="${i}">${xml("'"+s.name.replaceAll("'","''")+"'!$A$1:$"+column(s.dates.length+2)+'$'+(8+Math.max(s.rows.length,1)))}</definedName>`).join('')}</definedNames></workbook>`],['xl/_rels/workbook.xml.rels',prolog+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',styles()]];
 sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheetXML(s)]));return zip(files);
}
