// Shared exhibitor validation. Keep the server copy identical.
export type ExhibitZone={x:number;y:number;w:number;h:number};
export type ExhibitProduct={id:string;code:string;description:string;key:string;brand:string;dimensions:string;installation:string;source:string;image:string;drawing:string;specs:{label:string;value:string}[];zone:ExhibitZone|null;placement:string};
export type ExhibitData={name:string;project:string;notes:string;referenceNote:string;photo:string;plan:string;planNote:string;products:ExhibitProduct[];published:boolean};
export type ExhibitRecord={id:string;revision:string;updatedAt:string;data:ExhibitData};
export const EXHIBIT_REFERENCE='Fotografía de referencia. Las zonas indican dónde se propone colocar los artículos actuales. Fabricar conforme al plano y al listado de este proyecto.';
export const exhibitAssetName=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(v);
export function validateExhibit(v:any):ExhibitData{
 const fail=(message:string):never=>{throw Error(message);};
 const text=(s:unknown,max:number,required=false)=>typeof s==='string'&&s.length<=max&&(!required||!!s.trim())?s.trim():fail('Revisa los textos del exhibidor.');
 const asset=(s:unknown)=>s===''?'':exhibitAssetName(s)?s:fail('Imagen no válida.');
 const uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s)?s:fail('Identificador no válido.');
 if(!v||!Array.isArray(v.products)||v.products.length>100||typeof v.published!=='boolean')fail('Usa hasta 100 artículos por exhibidor.');
 const ids=new Set<string>();const products=v.products.map((p:any)=>{
  const id=uuid(p.id);if(ids.has(id))fail('Hay artículos duplicados.');ids.add(id);
  const source=text(p.source,1500);if(source){let u:URL;try{u=new URL(source);}catch{fail('Usa un enlace oficial de Truper.');}if(u!.protocol!=='https:'||!['www.truper.com','truper.com'].includes(u!.hostname)||u!.username||u!.password)fail('Usa un enlace oficial de Truper.');}
  let zone:ExhibitZone|null=null;if(p.zone!==null){if(!p.zone||['x','y','w','h'].some(k=>typeof p.zone[k]!=='number'||!Number.isFinite(p.zone[k]))||p.zone.x<0||p.zone.y<0||p.zone.w<.005||p.zone.h<.005||p.zone.x+p.zone.w>1.000001||p.zone.y+p.zone.h>1.000001)fail('La zona debe quedar dentro de la foto.');zone={x:p.zone.x,y:p.zone.y,w:p.zone.w,h:p.zone.h};}
  if(!Array.isArray(p.specs)||p.specs.length>40)fail('Revisa las características del artículo.');
  return {id,code:text(p.code,40,true),description:text(p.description,2000,true),key:text(p.key,100),brand:text(p.brand,100),dimensions:text(p.dimensions,2000),installation:text(p.installation,2000),source,image:asset(p.image),drawing:asset(p.drawing),specs:p.specs.map((s:any)=>({label:text(s.label,150,true),value:text(s.value,1000,true)})),zone,placement:text(p.placement,1000)};
 });
 const data={name:text(v.name,160,true),project:text(v.project,160),notes:text(v.notes,6000),referenceNote:text(v.referenceNote,2000,true),photo:asset(v.photo),plan:asset(v.plan),planNote:text(v.planNote,2000),products,published:v.published};
 if(data.published&&(!data.photo||!data.products.length))fail('Agrega una fotografía y artículos antes de publicar.');
 return data;
}
export function exhibitAssets(d:ExhibitData){return [...new Set([d.photo,d.plan,...d.products.flatMap(p=>[p.image,p.drawing])].filter(Boolean))];}
export function zoneFromDrag(a:{x:number;y:number},b:{x:number;y:number}):ExhibitZone|null{
 const clamp=(n:number)=>Math.min(1,Math.max(0,n)),x=Math.min(clamp(a.x),clamp(b.x)),y=Math.min(clamp(a.y),clamp(b.y)),w=Math.abs(clamp(a.x)-clamp(b.x)),h=Math.abs(clamp(a.y)-clamp(b.y));return w<.005||h<.005?null:{x,y,w,h};
}
