import {normalizeRequestUnits,headerUnit} from './quote-units';
import {QRequest,QLine,QData,qNormalize} from './quotes-core';
import {newTaskId} from './dashboard-model';
export type ImportTable={rows:string[][];message:string};
const xml=(s:string)=>{const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.querySelector('parsererror'))throw Error('No se pudo leer el archivo Excel.');return doc;};
export async function readXlsx(buffer:ArrayBuffer):Promise<string[][]>{
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('El archivo no es un XLSX válido.');const count=view.getUint16(end+10,true);let pos=view.getUint32(end+16,true),expanded=0;const files=new Map<string,string>();
 for(let i=0;i<count;i++){
 if(pos+46>bytes.length||view.getUint32(pos,true)!==0x02014b50)throw Error('Archivo Excel incompleto.');
 const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),len=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true),name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+len));pos+=46+len+extra+comment;
 if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(name))continue;
 expanded+=size;if(expanded>40000000||offset+30>bytes.length)throw Error('El Excel es demasiado grande para importar.');
 const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+compressed>bytes.length)throw Error('Archivo Excel incompleto.');
 let data=bytes.slice(start,start+compressed);if(method===8){const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader(),parts:Uint8Array[]=[];let total=0;while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.length;if(total>size||total>40000000){await reader.cancel();throw Error('Excel demasiado grande.');}parts.push(chunk.value);}data=new Uint8Array(total);let at=0;for(const part of parts){data.set(part,at);at+=part.length;}}else if(method!==0)throw Error('Formato de compresión no compatible.');
 files.set(name,new TextDecoder().decode(data));
 }
 const strings=files.has('xl/sharedStrings.xml')?Array.from(xml(files.get('xl/sharedStrings.xml')!).getElementsByTagName('si')).map(v=>v.textContent||''):[];
 let sheet='xl/worksheets/sheet1.xml';const wb=files.get('xl/workbook.xml'),rels=files.get('xl/_rels/workbook.xml.rels');if(wb&&rels){const first=xml(wb).getElementsByTagName('sheet')[0],id=first?.getAttribute('r:id');const rel=Array.from(xml(rels).getElementsByTagName('Relationship')).find(v=>v.getAttribute('Id')===id);const target=rel?.getAttribute('Target');if(target)sheet=target.startsWith('/')?target.slice(1):'xl/'+target;}
 const source=files.get(sheet);if(!source)throw Error('No encontramos la primera hoja del Excel.');
 return Array.from(xml(source).getElementsByTagName('row')).slice(0,1000).map(row=>{const result:string[]=[];for(const cell of Array.from(row.getElementsByTagName('c'))){const ref=cell.getAttribute('r')||'A1';let index=0;for(const c of ref.replace(/\d/g,''))index=index*26+c.charCodeAt(0)-64;const value=cell.getElementsByTagName('v')[0]?.textContent||'';result[index-1]=cell.getAttribute('t')==='s'?strings[Number(value)]||'':cell.getAttribute('t')==='inlineStr'?cell.getElementsByTagName('is')[0]?.textContent||'':value;}return Array.from({length:result.length},(_,i)=>result[i]||'');});
}
export async function readQuoteFile(file:File):Promise<ImportTable>{
 if(file.size>20000000)throw Error('Importa un archivo de hasta 20 MB.');const ext=file.name.split('.').at(-1)?.toLowerCase();
 if(ext==='xlsx')return {rows:await readXlsx(await file.arrayBuffer()),message:'Primera hoja del Excel. Selecciona encabezados y columnas; revisa las cantidades e importes antes de guardar.'};
 if(ext==='csv'||ext==='tsv'||ext==='txt'){const text=await file.text(),sep=ext==='tsv'?'\t':text.split('\n')[0].includes(';')?';':',';return {rows:parseDelimited(text,sep),message:'Revisa el separador y los valores antes de guardar.'};}
 if(ext==='pdf'){
 const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
 try{if(pdf.numPages>50)throw Error('Importa hasta 50 páginas por archivo.');const rows:string[][]=[];
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();const lines=new Map<number,any[]>();for(const item of content.items){if(!('str'in item))continue;const y=Math.round(item.transform[5]/3)*3;lines.set(y,[...(lines.get(y)||[]),item]);}for(const [,items]of [...lines].sort((a,b)=>b[0]-a[0]))rows.push(items.sort((a,b)=>a.transform[4]-b.transform[4]).filter(v=>v.str.trim()).map(v=>v.str));}
 if(!rows.some(r=>r.some(v=>v.trim())))throw Error('Este PDF parece escaneado. Necesita transcripción u OCR; puedes capturar o pegar los renglones en el editor.');
 return {rows,message:'Texto extraído del PDF. Las columnas pueden variar: selecciona el encabezado, revisa la vista previa y corrige lo necesario. No se han confirmado equivalencias.'};
 }finally{await pdf.destroy();}
 }
 throw Error('Importa XLSX, CSV, TSV o PDF con texto. Para imágenes o PDF escaneados, captura los conceptos en el editor.');
}
export function parseDelimited(text:string,separator=','){const rows:string[][]=[],row:string[]=[];let value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push([...row]);row.length=0;value='';}else value+=c;}if(value||row.length){row.push(value);rows.push([...row]);}return rows;}
export function parseNumber(text:string):number|null{let v=text.trim().replace(/[$\s]/g,'');if(!v)return null;if(v.includes(',')&&v.includes('.')){v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');}else if(v.includes(','))v=/^\d{1,3}(,\d{3})+$/.test(v)?v.replace(/,/g,''):v.replace(',','.');const n=Number(v);return Number.isFinite(n)?n:null;}
export type ColumnMap={description:number;material:number;width:number;height:number;quantity:number;amount:number;group:number;unit?:number};
export function suggestMatch(description:string,requests:QRequest[]){const text=qNormalize(description),exact=requests.filter(r=>qNormalize(r.title)===text);if(exact.length===1)return exact[0].id;return null;}
export function requestRows(rows:string[][],map:ColumnMap,headers:string[]=[] ):QRequest[]{return rows.filter(r=>r[map.description]?.trim()).map(r=>{const quantity=parseNumber(r[map.quantity]||'');if(quantity===null||quantity<=0)throw Error('Hay conceptos sin cantidad válida. Ajusta la columna o los datos.');return normalizeRequestUnits({id:newTaskId(),title:r[map.description].trim(),material:r[map.material]||'',width:r[map.width]||'',height:r[map.height]||'',quantity,unit:map.unit!==undefined&&map.unit>=0?r[map.unit]||'':'',group:r[map.group]||''},headerUnit(headers[map.width]||''),headerUnit(headers[map.height]||''));});}
export function offerRows(rows:string[][],map:ColumnMap,data:QData):QLine[]{return rows.filter(r=>r[map.description]?.trim()).map(r=>{const amount=parseNumber(r[map.amount]||'');if(amount!==null&&amount<0)throw Error('Hay importes negativos. Revisa las columnas.');return {id:newTaskId(),request_id:suggestMatch(r[map.description],data.requests)||(()=>{const aliases=[...new Set(data.offers.flatMap(o=>o.lines).filter(l=>l.review==='confirmed'&&l.request_id&&qNormalize(l.description)===qNormalize(r[map.description])).map(l=>l.request_id))];return aliases.length===1?aliases[0]:null;})(),description:r[map.description].trim(),material:r[map.material]||'',width:r[map.width]||'',height:r[map.height]||'',quantity:parseNumber(r[map.quantity]||''),amount:amount===null?null:Math.round(amount*100),review:'pending',note:''};});}

export function guessColumns(row:string[]):ColumnMap{const headings=row.map(qNormalize);const find=(choices:string[])=>headings.findIndex(h=>choices.includes(h));const dimension=(names:string[])=>{const exact=find(names);return exact>=0?exact:row.findIndex(h=>names.some(n=>qNormalize(h.replace(/\([^)]*\)|\[[^\]]*\]/g,'').replace(/\s+(cm|mm|m|metros?|cent[ií]metros?|mil[ií]metros?|in|ft|px)$/i,'').trim())===n));};return {description:find(['grafico','concepto','descripcion','descripciondelconcepto','description','producto','articulo']),material:find(['material','materialyespesor']),width:dimension(['ancho','width']),height:dimension(['alto','height']),quantity:find(['cantidad','quantity','piezas','pzas']),amount:find(['importe','importetotal','total','amount','totaldelrenglon']),group:find(['grupo','descint','categoria']),unit:find(['unidaddemedida','unidaddelasmedidas','unidaddemedidas','unidadmedidas','unidadmedida','unidad','unit','units'])};}

export function guessHeader(rows:string[][]){let best=0,score=-1;rows.slice(0,30).forEach((r,i)=>{const columns=guessColumns(r),n=Object.values(columns).filter(v=>v>=0).length;if(n>score){score=n;best=i;}});return best;}
