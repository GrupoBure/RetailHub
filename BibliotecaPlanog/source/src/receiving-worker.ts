import {readReceivingWorkbook} from './receiving-xlsx';
import {buildReceivingIndex} from './receiving-model';
self.onmessage=async(event:MessageEvent<ArrayBuffer>)=>{
 try{self.postMessage({progress:'Leyendo la base de productos…'});const rows=await readReceivingWorkbook(event.data);self.postMessage({progress:'Organizando códigos de barras y ubicaciones…'});const index=buildReceivingIndex(rows);self.postMessage({ok:true,index});}
 catch(error){self.postMessage({ok:false,error:(error as Error).message||'No se pudo leer la base de recepción.'});}
};
