// Attachment transfer never changes quotation data or its saved revision.
export type QuoteUploadTask={id:string;recordId:string;recordTitle:string;file:File;ticket?:string;offset:number};
export type QuoteUploadFailure={task:QuoteUploadTask;message:string};
type Api=(path:string,init?:RequestInit)=>Promise<any>;
async function uploadCall(api:Api,path:string,init:RequestInit,signal?:AbortSignal){
 const controller=new AbortController();const cancel=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(),45000);
 try{return await api(path,{...init,signal:controller.signal});}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function transferQuoteAttachment(api:Api,task:QuoteUploadTask,signal?:AbortSignal,onProgress?:(task:QuoteUploadTask)=>void){
 const check=()=>{if(signal?.aborted)throw new DOMException('Carga cancelada','AbortError');};check();
 if(!task.ticket){const result=await uploadCall(api,'quote-files/start',{method:'POST',body:JSON.stringify({document_id:task.recordId,filename:task.file.name,size:task.file.size})},signal);task.ticket=result.ticket;}
 while(task.offset<task.file.size){check();const part=task.file.slice(task.offset,task.offset+8*1024*1024);await uploadCall(api,'quote-files/chunk',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Upload-Ticket':task.ticket!,'X-Upload-Offset':String(task.offset)},body:part},signal);task.offset+=part.size;onProgress?.(task);}
 check();return uploadCall(api,'quote-files/finish',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Upload-Ticket':task.ticket!,'X-Upload-Offset':String(task.offset)},body:new Uint8Array()},signal);
}
export async function uploadQuoteAttachments(api:Api,tasks:QuoteUploadTask[],signal?:AbortSignal,onProgress?:(task:QuoteUploadTask)=>void){
 const completed:QuoteUploadTask[]=[],failed:QuoteUploadFailure[]=[];
 for(const task of tasks){try{onProgress?.(task);await transferQuoteAttachment(api,task,signal,onProgress);completed.push(task);}catch(e){const aborted=signal?.aborted||(e as Error).name==='AbortError';failed.push({task,message:aborted?'Carga cancelada o sin respuesta a tiempo. La cotización está guardada.':(e as Error).message||'No se pudo adjuntar este archivo.'});}}
 return {completed,failed};
}
