const MAX_EXPANDED=50000000,MAX_ROWS=100000;
const unescapeXML=(s:string)=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v:string)=>{if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[v.toLowerCase()]||'';});
const attr=(s:string,name:string)=>unescapeXML(s.match(new RegExp('(?:^|\\s)'+name+'=["\']([^"\']*)["\']'))?.[1]||'');
const texts=(s:string)=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>unescapeXML(m[1])).join('');
export async function readReceivingWorkbook(buffer:ArrayBuffer):Promise<string[][]>{
 if(buffer.byteLength>20000000)throw Error('La base supera 20 MB.');
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Selecciona un archivo XLSX válido.');
 const count=view.getUint16(end+10,true);if(count>2000)throw Error('El Excel contiene demasiados archivos internos.');
 let pos=view.getUint32(end+16,true),expanded=0;const files=new Map<string,string>();
 for(let i=0;i<count;i++){
  if(pos+46>bytes.length||view.getUint32(pos,true)!==0x02014b50)throw Error('Archivo Excel incompleto.');
  const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),len=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true),name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+len));pos+=46+len+extra+comment;
  if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(name))continue;
  expanded+=size;if(expanded>MAX_EXPANDED||offset+30>bytes.length)throw Error('La base Excel es demasiado grande para leerla en este equipo.');
  const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+compressed>bytes.length)throw Error('Archivo Excel incompleto.');let data=bytes.slice(start,start+compressed);
  if(method===8){const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader(),parts:Uint8Array[]=[];let total=0;for(;;){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.length;if(total>size||total>MAX_EXPANDED){await reader.cancel();throw Error('El Excel excede el tamaño permitido.');}parts.push(chunk.value);}data=new Uint8Array(total);let n=0;for(const part of parts){data.set(part,n);n+=part.length;}}
  else if(method!==0)throw Error('La compresión del Excel no es compatible.');files.set(name,new TextDecoder().decode(data));
 }
 const strings=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1]));
 let sheet='xl/worksheets/sheet1.xml';const wb=files.get('xl/workbook.xml')||'',rels=files.get('xl/_rels/workbook.xml.rels')||'',first=wb.match(/<sheet\s([^>]+)\/?\s*>/),id=first?attr(first[1],'r:id'):'';
 if(id){const rel=[...rels.matchAll(/<Relationship\s([^>]+)\/?\s*>/g)].find(m=>attr(m[1],'Id')===id),target=rel?attr(rel[1],'Target'):'';if(target)sheet=target.startsWith('/')?target.slice(1):'xl/'+target;}
 const source=files.get(sheet);if(!source)throw Error('No se encontró la primera hoja de la base.');const rows:string[][]=[];
 for(const match of source.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  if(rows.length>=MAX_ROWS)throw Error('La base supera '+MAX_ROWS.toLocaleString('es-MX')+' filas. No se cargó parcialmente.');const row:string[]=[];
  for(const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=attr(cell[1],'r')||'A1';let column=0;for(const c of ref.replace(/\d/g,''))column=column*26+c.charCodeAt(0)-64;if(column<1||column>64)continue;
   const type=attr(cell[1],'t'),raw=cell[2]||'',value=unescapeXML(raw.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]||'');
   if(type==='e')throw Error('La base contiene un error de Excel en '+ref+'.');row[column-1]=type==='s'?strings[Number(value)]||'':type==='inlineStr'?texts(raw):value;
  }
  rows.push(Array.from({length:row.length},(_,i)=>row[i]||''));
 }
 return rows;
}
