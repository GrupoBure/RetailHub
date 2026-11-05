export type ReceivingLocation={gondola:string;family:string;aisle:string};
export type ReceivingProduct={code:string;key:string;description:string;barcodes:string[];locations:ReceivingLocation[]};
export type ReceivingIndex={products:Map<string,ReceivingProduct>;barcodes:Map<string,string[]>;stats:{rows:number;products:number;barcodes:number;missingBarcodes:number;planned:number;notPlanned:number}};
export type ReceivingMatch={kind:'found';product:ReceivingProduct;by:'barcode'|'code';query:string}|{kind:'ambiguous';products:ReceivingProduct[];query:string}|{kind:'not-found';query:string};
export const receivingText=(v:unknown)=>v==null?'':String(v).trim();
export const receivingKey=(v:unknown)=>receivingText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
export const isUnplanned=(v:unknown)=>['','np','noplanogramado','null'].includes(receivingKey(v));
export const isProductPlanned=(p:ReceivingProduct)=>p.locations.some(l=>!isUnplanned(l.gondola));
export function normalizeReceivingInput(value:string){
 let s=value.trim();const gs1=s.startsWith(']C1');s=s.replace(/^\][A-Za-z][0-9]/,'').replace(/[\r\n\t ]/g,'');
 if(gs1&&/^01\d{14}(?:\x1d|$)/.test(s))s=s.slice(2,16);
 return s;
}
function identifier(value:unknown){const s=receivingText(value);if(/^\d+$/.test(s))return s;if(/^\d+(?:\.\d+)?[eE]\+?\d+$/.test(s)||/^\d+\.0+$/.test(s)){const n=Number(s);if(Number.isSafeInteger(n)&&n>=0)return String(n);}return s;}
export function buildReceivingIndex(rows:unknown[][]):ReceivingIndex{
 const required=['codigobarras','codigo','clave','descripcion','gondola','familia','pasillo'];
 const header=rows.findIndex((r,i)=>i<20&&required.every(h=>r.some(c=>receivingKey(c)===(h==='codigobarras'?'codigobarras':h)||h==='codigobarras'&&receivingKey(c)==='codigodebarras')));
 if(header<0)throw Error('El Excel debe contener CODIGO BARRAS, CÓDIGO, CLAVE, DESCRIPCIÓN, GÓNDOLA, FAMILIA y PASILLO.');
 const columns=required.map(h=>rows[header].findIndex(c=>receivingKey(c)===h||h==='codigobarras'&&receivingKey(c)==='codigodebarras'));
 const products=new Map<string,ReceivingProduct>(),barcodeSets=new Map<string,Set<string>>();let count=0,missingBarcodes=0;
 for(let i=header+1;i<rows.length;i++){
  const r=rows[i];if(!r.some(c=>receivingText(c)))continue;
  const [b,c,k,d,g,f,a]=columns.map(j=>r[j]),code=identifier(c);if(!/^\d{4,8}$/.test(code))throw Error('Código de producto no válido en la fila '+(i+1)+'. Revisa el Excel antes de usarlo.');
  const key=receivingText(k),description=receivingText(d);if(!key||!description)throw Error('Falta clave o descripción en la fila '+(i+1)+'.');
  const location={gondola:receivingText(g),family:receivingText(f),aisle:receivingText(a)};
  let product=products.get(code);if(!product){product={code,key,description,barcodes:[],locations:[]};products.set(code,product);}
  if(product.key!==key||product.description!==description)throw Error('El producto '+code+' tiene claves o descripciones distintas. Revisa sus filas en el Excel.');
  if(!product.locations.some(l=>l.gondola===location.gondola&&l.family===location.family&&l.aisle===location.aisle))product.locations.push(location);
  const barcode=identifier(b);if(/^\d{8,14}$/.test(barcode)){if(!product.barcodes.includes(barcode))product.barcodes.push(barcode);let set=barcodeSets.get(barcode);if(!set){set=new Set;barcodeSets.set(barcode,set);}set.add(code);}else if(['','null','none'].includes(barcode.toLowerCase()))missingBarcodes++;else throw Error('Código de barras no válido en la fila '+(i+1)+'.');
  count++;
 }
 if(!products.size)throw Error('El Excel no contiene productos.');
 const barcodes=new Map([...barcodeSets].map(([b,set])=>[b,[...set]])),planned=[...products.values()].filter(isProductPlanned).length;
 return {products,barcodes,stats:{rows:count,products:products.size,barcodes:barcodes.size,missingBarcodes,planned,notPlanned:products.size-planned}};
}
export function findReceivingProduct(index:ReceivingIndex,raw:string):ReceivingMatch{
 const query=normalizeReceivingInput(raw),codes=new Set(index.barcodes.get(query)||[]);if(index.products.has(query))codes.add(query);
 if(!codes.size)return {kind:'not-found',query};const products=[...codes].map(c=>index.products.get(c)!).filter(Boolean);
 return products.length===1?{kind:'found',product:products[0],by:index.barcodes.has(query)?'barcode':'code',query}:{kind:'ambiguous',products,query};
}
export function receivingImageURLs(key:string){
 const stem=key.trim().replace(/\//g,'-').replace(/\s+/g,'-');if(!stem||stem.length>100||!/^[A-Za-z0-9_+().-]+$/.test(stem))return [];
 return ['jpg','png','webp'].map(ext=>'https://www.truper.com/media/import/imagenes/'+encodeURIComponent(stem)+'.'+ext);
}
export const receivingSheetURL=(code:string)=>'https://www.truper.com/ficha_tecnica_pdf/views/ficha-print.php?codigo='+encodeURIComponent(code);
