export type MountZone={id:string;number:string;family:string;x:number;y:number;w:number;h:number;stage:0|1|2|3;note:string};
export type MountData={name:string;image:string;original:string;zones:MountZone[]};
export type MountRecord={id:string;revision:string;updatedAt:string;data:MountData};
export const MOUNT_STAGES=['Sin avance','Accesorios colocados','Producto colocado','Precios colocados'];
export const MOUNT_COLORS=['#64748b','#eab308','#16a34a','#2563eb'];
export function validateMount(value:unknown):MountData{
 const v=value as MountData,fail=()=>{throw Error('Revisa el nombre, el plano y las zonas de las góndolas.');};
 const text=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max;
 const asset=(s:unknown)=>typeof s==='string'&&(/^[a-f0-9-]{36}\.(?:jpg|png|webp|pdf)$/.test(s)||s==='');
 if(!v||!text(v.name,120)||!v.name.trim()||!asset(v.image)||!v.image||!/\.(jpg|png|webp)$/.test(v.image)||!asset(v.original)||!Array.isArray(v.zones)||v.zones.length>1000)fail();
 const ids=new Set(),numbers=new Set();
 const zones=v.zones.map(z=>{if(!z||!text(z.id,60)||!/^[a-zA-Z0-9-]+$/.test(z.id)||ids.has(z.id)||!text(z.number,30)||!z.number.trim()||numbers.has(z.number.trim().toLowerCase())||!text(z.family,120)||!text(z.note,1500)||![0,1,2,3].includes(z.stage)||![z.x,z.y,z.w,z.h].every(n=>typeof n==='number'&&Number.isFinite(n))||z.x<0||z.y<0||z.w<.002||z.h<.002||z.x+z.w>1.000001||z.y+z.h>1.000001)fail();ids.add(z.id);numbers.add(z.number.trim().toLowerCase());return {id:z.id,number:z.number.trim(),family:z.family.trim(),note:z.note,stage:z.stage,x:z.x,y:z.y,w:z.w,h:z.h};});
 return {name:v.name.trim(),image:v.image,original:v.original,zones};
}
export function mountStage(checked:boolean,index:1|2|3,current:0|1|2|3):0|1|2|3{return (checked?index:Math.min(current,index-1)) as 0|1|2|3;}
