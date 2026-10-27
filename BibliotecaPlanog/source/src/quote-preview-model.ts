import {QuoteRecordData,recordCell,recordNumber,recordAmount,validateQuoteRecord} from './quote-records';
export function quotePreviewModel(data:QuoteRecordData){
 const warnings:string[]=[];try{validateQuoteRecord(data,true);}catch{warnings.push('Hay campos o columnas por revisar en la captura.');}
 let calculated=false;
 const rows=data.rows.map((row,index)=>{
 const quantityRaw=recordCell(data,row,'quantity'),quantity=recordNumber(quantityRaw),priceRaw=recordCell(data,row,'unit_price'),price=recordNumber(priceRaw),amountRaw=recordCell(data,row,'amount'),rawAmount=recordAmount(data,row);
 const amount=rawAmount!==null&&rawAmount>=0&&Number.isSafeInteger(rawAmount)?rawAmount:null;
 let unitPrice=price!==null&&price>=0?Math.round(price*100):null;
 let derived=false;if(!priceRaw.trim()&&unitPrice===null&&amount!==null&&quantity!==null&&quantity>0){unitPrice=Math.round(amount/quantity);derived=true;calculated=true;}
 const mismatch=quantity!==null&&quantity>0&&price!==null&&price>=0&&amountRaw.trim()&&amount!==null&&Math.abs(Math.round(price*quantity*100)-amount)>1;
 if(mismatch)warnings.push('Renglón '+(index+1)+': el importe capturado difiere de cantidad × precio unitario.');
 return {id:row.id,quantity:quantityRaw||'—',description:recordCell(data,row,'description')||'Concepto por definir',details:data.columns.flatMap((c,i)=>['attribute','ignore'].includes(c.role)&&row.cells[i]?.trim()?[{label:c.label,value:row.cells[i]}]:[]),unitPrice,derived,priceRaw,amount};
 });
 const partial=rows.some(r=>r.amount===null),subtotal=rows.reduce((n,r)=>n+(r.amount??0),0),hasPrices=rows.some(r=>r.amount!==null),tax=Number.isFinite(data.tax_bp)&&data.tax_bp>=0?Math.round(subtotal*data.tax_bp/10000):0;
 if(data.type==='quote'&&partial)warnings.push('Hay '+rows.filter(r=>r.amount===null).length+' conceptos sin importe. Los totales son parciales.');
 if(data.type==='quote'&&hasPrices&&data.shipping===null)warnings.push('El envío está por confirmar y no se suma al total mostrado.');
 return {rows,warnings,calculated,hasPrices,partial,subtotal,tax,total:subtotal+tax+(data.shipping??0)};
}
