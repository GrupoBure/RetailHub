// Shared standalone quotation model. Keep the server copy identical.
export type RecordRole='description'|'quantity'|'unit_price'|'amount'|'attribute'|'ignore';
export type RecordColumn={id:string;label:string;role:RecordRole};
export type RecordRow={id:string;cells:string[]};
export type QuoteRecordData={title:string;type:'quote'|'request';supplier_id:string|null;supplier:string;currency:string;lead_days:number|null;lead_basis:string;terms:string;tax_bp:number;shipping:number|null;source:string;notes:string;columns:RecordColumn[];rows:RecordRow[]};
export type QuoteRecord={id:string;store_id:string;kind:'quote'|'request'|'template'|'comparison-template';title:string;revision:number;data:QuoteRecordData;updated_at:string};
export type SavedSupplier={id:string;name:string;revision:number;defaults:{lead_days:number|null;lead_basis:string;terms:string;tax_bp:number;shipping:number|null;currency:string}};
export const recordKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function recordNumber(text:string):number|null{let v=text.trim().replace(/[$\s]/g,'');if(!v)return null;if(v.includes(',')&&v.includes('.'))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');else if(v.includes(','))v=/^\d{1,3}(,\d{3})+$/.test(v)?v.replace(/,/g,''):v.replace(',','.');if(!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(v))return null;const n=Number(v);return Number.isFinite(n)?n:null;}
export function recordCell(d:QuoteRecordData,r:RecordRow,role:RecordRole){const i=d.columns.findIndex(c=>c.role===role);return i<0?'':r.cells[i]||'';}
export function recordAmount(d:QuoteRecordData,r:RecordRow){
 const rawTotal=recordCell(d,r,'amount');
 // A supplied total (including zero) wins; only an empty total is automatic.
 if(rawTotal.trim()){const total=recordNumber(rawTotal);return total===null?null:Math.round(total*100);}
 const price=recordNumber(recordCell(d,r,'unit_price')),qty=recordNumber(recordCell(d,r,'quantity'));
 return price===null||qty===null?null:Math.round(price*qty*100);
}
export function recordTotals(d:QuoteRecordData){const amounts=d.rows.map(r=>recordAmount(d,r)),subtotal=amounts.reduce<number>((a,v)=>a+(v??0),0);return {subtotal,total:subtotal+Math.round(subtotal*d.tax_bp/10000)+(d.shipping??0),missing:amounts.filter(a=>a===null).length,priced:amounts.filter(a=>a!==null).length};}
export function validateQuoteRecord(v:any,allowMissingSupplier=false):QuoteRecordData{
 const fail=(m:string):never=>{throw Error(m);};const text=(s:any,max:number,required=false)=>typeof s==='string'&&s.length<=max&&(!required||!!s.trim())?s.trim():fail('Revisa los textos de la cotización.');
 const num=(n:any,max:number,nullable=false)=>nullable&&n===null?null:typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max?n:fail('Revisa los importes y plazos.');
 if(!v||!['quote','request'].includes(v.type)||!Array.isArray(v.columns)||!v.columns.length||v.columns.length>30||!Array.isArray(v.rows)||v.rows.length>300)fail('Usa hasta 30 columnas y 300 renglones.');
 const columns:RecordColumn[]=v.columns.map((c:any)=>({id:text(c.id,80,true),label:text(c.label,100,true),role:['description','quantity','unit_price','amount','attribute','ignore'].includes(c.role)?c.role:fail('Tipo de columna no válido.')}));
 for(const role of ['quantity','unit_price','amount'])if(columns.filter(c=>c.role===role).length>1)fail('Asigna una sola columna a '+role+'.');
 if(columns.filter(c=>c.role==='description').length!==1)fail('Elige una columna de descripción.');if(new Set(columns.map(c=>c.id)).size!==columns.length)fail('Hay columnas duplicadas.');
 const ids=new Set<string>();const rows:RecordRow[]=v.rows.map((r:any)=>{const id=text(r.id,80,true);if(ids.has(id))fail('Hay renglones duplicados.');ids.add(id);if(!Array.isArray(r.cells)||r.cells.length!==columns.length)fail('Revisa las columnas de cada renglón.');const row={id,cells:r.cells.map((c:any)=>text(c,500))};if(!row.cells[columns.findIndex(c=>c.role==='description')])fail('Cada renglón necesita una descripción.');for(const role of ['quantity','unit_price','amount'] as RecordRole[]){const raw=recordCell({columns} as QuoteRecordData,row,role),n=recordNumber(raw);if(raw&&(n===null||n<0||(role==='quantity'&&(n===0||n>1000000))||n>1000000000))fail('Revisa la cantidad o el precio del renglón '+(ids.size)+'.');}return row;});
 const data:QuoteRecordData={title:text(v.title,200,true),type:v.type,supplier_id:v.supplier_id===null?null:/^[a-f0-9-]{36}$/i.test(v.supplier_id)?v.supplier_id:fail('Proveedor no válido.'),supplier:text(v.supplier,150,v.type==='quote'&&!allowMissingSupplier),currency:['MXN','USD','EUR'].includes(v.currency)?v.currency:fail('Moneda no válida.'),lead_days:num(v.lead_days,1000,true),lead_basis:text(v.lead_basis,200),terms:text(v.terms,2000),tax_bp:num(v.tax_bp,10000)!,shipping:num(v.shipping,100000000000,true),source:text(v.source,200),notes:text(v.notes,3000),columns,rows};
 if(!Number.isInteger(data.tax_bp)||(data.shipping!==null&&!Number.isSafeInteger(data.shipping)))fail('Revisa los decimales de impuestos y envío.');
 if(rows.some(r=>recordAmount(data,r)!==null&&!Number.isSafeInteger(recordAmount(data,r))))fail('Importe fuera de rango.');return data;
}

