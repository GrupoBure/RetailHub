import type {ExhibitProduct} from './exhibit-model';
export type BatchRow={id:string;code:string;status:'ok'|'error'|'skipped';message:string};
export async function runExhibitBatch(options:{products:ExhibitProduct[];refresh:boolean;signal:AbortSignal;resolve:(p:ExhibitProduct,signal:AbortSignal)=>Promise<{patch:Partial<ExhibitProduct>;warnings:string[]}>;apply:(p:ExhibitProduct,patch:Partial<ExhibitProduct>)=>void;progress:(done:number,total:number,code:string)=>void}){
 const {products,refresh,signal,resolve,apply,progress}=options,rows:BatchRow[]=[],cache=new Map<string,Awaited<ReturnType<typeof resolve>>>();
 for(const p of products){if(signal.aborted)break;const code=p.code.trim();progress(rows.length,products.length,code);
  if(!/^\d{4,8}$/.test(code)){rows.push({id:p.id,code,status:'skipped',message:code?'Código no válido para Truper.':'Sin código: pendiente.'});continue;}
  if(!refresh&&p.description.trim()&&p.key.trim()){rows.push({id:p.id,code,status:'skipped',message:'Ya tiene ficha; se conserva.'});continue;}
  try{const key=code+'|'+p.source;let result=cache.get(key);if(!result){result=await resolve({...p,code},signal);signal.throwIfAborted();if(result.patch.code!==code)throw Error('La ficha no corresponde al código solicitado.');cache.set(key,result);}signal.throwIfAborted();apply(p,result.patch);rows.push({id:p.id,code,status:'ok',message:result.warnings.join(' · ')||'Ficha incorporada.'});}
  catch(e){if(signal.aborted)break;rows.push({id:p.id,code,status:'error',message:(e as Error).message||'No se pudo consultar la ficha.'});}
 }
 progress(rows.length,products.length,'');return {rows,cancelled:signal.aborted};
}
