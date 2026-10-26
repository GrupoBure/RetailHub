import {QData,QLine,QRequest,validateQData} from './quotes-core';
import {newTaskId} from './dashboard-model';
export function quoteFromTemplate(name:string,requests:QRequest[]):QData{
 const data=validateQData({title:name,requests,offers:[],notes:''});
 return {...data,requests:data.requests.map(r=>({...r,id:newTaskId()}))};
}
export function linesFromRequest(requests:QRequest[],existing:QLine[]):QLine[]{
 const mapped=new Set(existing.map(l=>l.request_id));
 return requests.filter(r=>!mapped.has(r.id)).map(r=>({id:newTaskId(),request_id:r.id,description:r.title,material:r.material,width:r.width,height:r.height,quantity:r.quantity,amount:null,review:'pending',note:''}));
}
