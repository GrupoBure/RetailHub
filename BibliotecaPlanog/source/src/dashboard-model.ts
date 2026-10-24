export function newTaskId(){const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
export const states=['Pendiente','En proceso','En revisión','Terminado','Bloqueado','No aplica'] as const;
export type TaskStatus=typeof states[number];
export type Task={id:string;parent_id:string|null;title:string;status:TaskStatus;owner:string;due:string;notes:string};
export type Board={store_id:string;revision:number;items:Task[];updated_at:string};
export function descendants(items:Task[],id:string):Task[]{const children=items.filter(v=>v.parent_id===id);return children.flatMap(v=>[v,...descendants(items,v.id)]);}
export function leaves(items:Task[],id:string|null=null):Task[]{const subset=id===null?items:descendants(items,id);return subset.filter(v=>!items.some(c=>c.parent_id===v.id));}
export function progress(items:Task[],id:string|null=null){const all=leaves(items,id),applicable=all.filter(v=>v.status!=='No aplica'),done=applicable.filter(v=>v.status==='Terminado').length;return {all,applicable:applicable.length,done,percent:applicable.length?Math.round(done/applicable.length*1000)/10:0};}
export function effectiveStatus(items:Task[],item:Task):TaskStatus{
 if(!items.some(v=>v.parent_id===item.id))return item.status;
 const stats=progress(items,item.id);if(!stats.applicable)return 'No aplica';
 if(stats.done===stats.applicable)return 'Terminado';
 const active=stats.all.filter(v=>v.status!=='No aplica');
 if(active.some(v=>v.status==='Bloqueado'))return 'Bloqueado';
 if(active.some(v=>v.status==='En proceso')||stats.done>0)return 'En proceso';
 if(active.some(v=>v.status==='En revisión'))return 'En revisión';return 'Pendiente';
}
export function moveSibling(items:Task[],id:string,direction:number){const item=items.find(v=>v.id===id);if(!item)return items;const siblings=items.filter(v=>v.parent_id===item.parent_id);const at=siblings.findIndex(v=>v.id===id),other=siblings[at+direction];if(!other)return items;const copy=[...items],a=copy.findIndex(v=>v.id===id),b=copy.findIndex(v=>v.id===other.id);[copy[a],copy[b]]=[copy[b],copy[a]];return copy;}
export function depthOf(items:Task[],id:string|null){let depth=0;while(id!==null){const item=items.find(v=>v.id===id);if(!item)break;depth++;id=item.parent_id;}return depth;}
