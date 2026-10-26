export type QRequest={id:string;title:string;material:string;width:string;height:string;quantity:number;unit:string;group:string};
export type QLine={id:string;request_id:string|null;description:string;material:string;width:string;height:string;quantity:number|null;amount:number|null;review:'pending'|'confirmed'|'clarify';note:string};
export type QOffer={id:string;supplier:string;lead_days:number|null;lead_basis:string;terms:string;source:string;reported_subtotal:number|null;tax_bp:number;shipping:number|null;lines:QLine[]};
export type QData={title:string;requests:QRequest[];offers:QOffer[];notes:string};
export const qNormalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function qIssues(request:QRequest,line:QLine){const issues:string[]=[];if(line.quantity!==request.quantity)issues.push('Cantidad distinta o sin confirmar');if(line.material&&qNormalize(line.material)!==qNormalize(request.material))issues.push('Material distinto');if(line.width&&line.width!==request.width||line.height&&line.height!==request.height)issues.push('Medidas distintas');return issues;}
export function qTotals(data:QData,offer:QOffer){
 const priced=offer.lines.filter(l=>l.amount!==null);const subtotal=priced.reduce((n,l)=>n+l.amount!,0),tax=Math.round(subtotal*offer.tax_bp/10000),total=subtotal+tax+(offer.shipping??0);
 const covered=new Set(priced.filter(l=>l.request_id).map(l=>l.request_id));const missing=data.requests.filter(r=>!covered.has(r.id));
 const errors:string[]=[];if(data.requests.some(r=>covered.has(r.id)&&(r.width||r.height)&&(!r.unit.trim()||/confirmar|pendiente/i.test(r.unit))))errors.push('Unidades de medida por confirmar');if(offer.shipping===null)errors.push('Envío por confirmar');if(offer.lines.some(l=>l.quantity===null))errors.push('Hay cantidades por confirmar');if(!priced.length)errors.push('Sin conceptos con precio');if(offer.lines.some(l=>l.amount===null))errors.push('Hay conceptos sin importe');
 if(offer.lines.some(l=>l.review!=='confirmed'))errors.push('Hay conceptos pendientes de revisión');
 if(offer.lines.some(l=>l.request_id&&qIssues(data.requests.find(r=>r.id===l.request_id)!,l).length&&!l.note.trim()))errors.push('Hay diferencias sin aclaración');
 if(offer.reported_subtotal!==null&&Math.abs(offer.reported_subtotal-subtotal)>1)errors.push('Los importes no coinciden con el subtotal del proveedor');
 if(offer.lead_days===null||!offer.lead_basis.trim())errors.push('Tiempo de elaboración por confirmar');
 return {subtotal,tax,total,missing,errors,extras:priced.filter(l=>l.request_id===null).length};
}
export function validateQData(value:any):QData{
 const fail=(message:string):never=>{throw Error(message);};
 const text=(v:any,max:number,required=false)=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim())?v.trim():fail('Revisa los textos y campos obligatorios.');
 const id=(v:any)=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)?v:fail('Identificador no válido.');
 const num=(v:any,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail('Cantidad o importe no válido.');
 const cents=(v:any)=>Number.isSafeInteger(v)?num(v,0,100000000000):fail('Usa importes válidos con hasta dos decimales.');
 if(!value||!Array.isArray(value.requests)||value.requests.length>300||!Array.isArray(value.offers)||value.offers.length>10)fail('Máximo 300 conceptos y 10 proveedores por comparativo.');
 const ids=new Set<string>(),unique=(v:any)=>{const key=id(v);if(ids.has(key))fail('Hay identificadores duplicados.');ids.add(key);return key;};
 const requests:QRequest[]=value.requests.map((r:any)=>({id:unique(r.id),title:text(r.title,300,true),material:text(r.material,200),width:text(r.width,30),height:text(r.height,30),quantity:num(r.quantity,0.0001,1000000),unit:text(r.unit,60),group:text(r.group,100)}));
 const requestIds=new Set(requests.map(r=>r.id));
 const offers:QOffer[]=value.offers.map((o:any)=>{if(!Array.isArray(o.lines)||o.lines.length>400)fail('Máximo 400 renglones por proveedor.');const mapped=new Set<string>();
 const lines:QLine[]=o.lines.map((l:any)=>{const ref=l.request_id===null?null:id(l.request_id);if(ref&&(!requestIds.has(ref)||mapped.has(ref)))fail('Cada renglón debe corresponder a un concepto distinto de la solicitud.');if(ref)mapped.add(ref);if(!['pending','confirmed','clarify'].includes(l.review))fail('Estado de revisión no válido.');return {id:unique(l.id),request_id:ref,description:text(l.description,500,true),material:text(l.material,200),width:text(l.width,30),height:text(l.height,30),quantity:l.quantity===null?null:num(l.quantity,0.0001,1000000),amount:l.amount===null?null:cents(l.amount),review:l.review,note:text(l.note,1500)};});
 return {id:unique(o.id),supplier:text(o.supplier,150,true),lead_days:o.lead_days===null?null:num(o.lead_days,0,1000),lead_basis:text(o.lead_basis,200),terms:text(o.terms,2000),source:text(o.source,200),reported_subtotal:o.reported_subtotal===null?null:cents(o.reported_subtotal),tax_bp:num(o.tax_bp,0,10000),shipping:o.shipping===null?null:cents(o.shipping),lines};});
 return {title:text(value.title,200,true),notes:text(value.notes,3000),requests,offers};
}
