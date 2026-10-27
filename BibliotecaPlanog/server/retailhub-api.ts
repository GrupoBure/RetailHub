// Retail Hub · Supabase Edge Function: retailhub-api
// No credentials belong in this file. Deploy with gateway Verify JWT OFF;
// protected routes verify the caller with Supabase Auth below.
const FRONTEND = 'https://grupobure.github.io/RetailHub/BibliotecaPlanog/';
const API_VERSION = '2026-10-24-stores';
const API_BUILD = 'quote-records-1';
const ORIGIN = new URL(FRONTEND).origin;
const env = new Proxy({}, {get:(_target,key)=>Deno.env.get(String(key))});
function injected(name:string, legacy:string) {
 const old=Deno.env.get(legacy); if(old)return old;
 try {return JSON.parse(Deno.env.get(name)||'{}').default;} catch {return undefined;}
}
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,content-type,x-upload-ticket,x-upload-offset,range',
 'Access-Control-Expose-Headers':'content-range,content-length,content-disposition','Vary':'Origin'};


export class PortalError extends Error { constructor(public status:number, message:string){super(message);} }
class DropboxNotFound extends PortalError {constructor(){super(404,'El archivo o la carpeta ya no existe en Dropbox.');}}
export const config = () => {
 const e=env as unknown as Record<string,string|undefined>;
 return {url:e.SUPABASE_URL?.replace(/\/$/,''),anon:injected('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),service:injected('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),
 dbxKey:e.DROPBOX_APP_KEY,dbxSecret:e.DROPBOX_APP_SECRET,refresh:e.DROPBOX_REFRESH_TOKEN,
 secret:e.RH_ENCRYPTION_SECRET||injected('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),root:(e.RH_DROPBOX_ROOT||'/Retail Hub/Portal').replace(/\/$/,'')};
};
export const authReady=()=>{const c=config();return !!(c.url&&c.anon&&c.service);};
export const json=(data:unknown,status=200,extra:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
export function sameOrigin(r:Request){const o=r.headers.get('origin');if(o && o!==ORIGIN)throw new PortalError(403,'Solicitud no permitida.');}
const bearer=(r:Request)=>r.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]||'';
function membership(u:any,admin=false){
 if(!u?.app_metadata?.rh_portal||u.app_metadata.disabled)throw new PortalError(403,'Este usuario no tiene acceso al portal.');
 if(admin&&u.app_metadata.role!=='admin')throw new PortalError(403,'Esta acción es solo para administradores.');
 return u;
}
const sessionData=(d:any)=>({user:safeUser(d.user),session:{access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in}});
async function bounded(r:Request,max:number){
 if(Number(r.headers.get('content-length'))>max)throw new PortalError(413,'El bloque es demasiado grande.');
 const reader=r.body?.getReader();if(!reader)return new Uint8Array();
 const parts:Uint8Array[]=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new PortalError(413,'El bloque es demasiado grande.');}parts.push(value);}
 const result=new Uint8Array(total);let at=0;for(const part of parts){result.set(part,at);at+=part.length;}return result;
}
async function bodyJSON(r:Request,max=16384){try{return JSON.parse(new TextDecoder().decode(await bounded(r,max)));}catch(e){if(e instanceof PortalError)throw e;throw new PortalError(400,'Solicitud no válida.');}}
export async function supa(path:string,init:RequestInit={},bearer?:string):Promise<any>{
 const c=config();if(!authReady())throw new PortalError(503,'La conexión de usuarios está pendiente de activación.');
 const h=new Headers(init.headers);h.set('apikey',c.anon!);const auth=bearer||c.service!;if(!auth.startsWith('sb_'))h.set('Authorization','Bearer '+auth);h.set('Content-Type','application/json');
 if(!bearer)h.set('apikey',c.service!);
 const r=await fetch(c.url+path,{...init,headers:h,signal:AbortSignal.timeout(30000)});
 if(!r.ok){const e=await r.json().catch(()=>({})) as any;
 if(r.status===429)throw new PortalError(429,'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
 if(r.status===401||r.status===403)throw new PortalError(401,'La sesión no es válida. Vuelve a iniciar sesión.');
 if(e.code==='23505'||String(e.message||'').includes('quote_conflict'))throw new PortalError(409,'Este comparativo cambió o ya fue autorizado. Actualiza la página.');
 if(String(e.message||'').includes('quote_has_approvals'))throw new PortalError(409,'Este comparativo tiene autorizaciones registradas y se conserva como historial.');
 if(String(e.message||'').includes('quote_access'))throw new PortalError(403,'No tienes permiso para autorizar esta tienda.');
 if(String(e.message||'').includes('quote_incomplete')||String(e.message||'').includes('quote_partial'))throw new PortalError(400,'Falta confirmar el alcance, los importes o el plazo de esta propuesta.');
 if(e.code==='email_exists'||e.code==='email_conflict'||e.code==='user_already_exists')throw new PortalError(409,'Ese nombre de usuario ya está en uso. Elige otro.');
 if(e.code==='42P01'||e.code==='PGRST205')throw new PortalError(503,'Falta preparar la base de datos. Revisa Conexiones.');
 throw new PortalError(400,'No se pudo completar la operación en la cuenta de usuarios.');}
 const text=await r.text();return text?JSON.parse(text):null;
}
export async function requireUser(r:Request,admin=false){
 const t=bearer(r);if(!t)throw new PortalError(401,'Inicia sesión para continuar.');
 return membership(await supa('/auth/v1/user',{},t),admin);
}
export const safeUser=(u:any)=>({id:u.id,name:u.user_metadata?.name||u.email?.split('@')[0],username:u.email?.split('@')[0],role:u.app_metadata?.role==='admin'?'admin':'reader',enabled:!u.app_metadata?.disabled,last_sign_in_at:u.last_sign_in_at,store_ids:storeIds(u),quote_view_store_ids:quoteStoreIds(u),quote_approve_store_ids:quoteStoreIds(u,true)});
export function username(v:unknown){if(typeof v!=='string'||!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(v.toLowerCase()))throw new PortalError(400,'Usa de 3 a 40 letras sin acentos, números, puntos o guiones para el usuario.');return v.toLowerCase();}
const email=(v:unknown)=>username(v)+'@usuarios.retailhub.invalid';
export {email};
export async function encrypted(value:string,decrypt=false){
 const secret=config().secret;if(!secret)throw new PortalError(503,'Falta activar la protección de la conexión.');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
 if(decrypt){const [a,b]=value.split('.');const iv=Uint8Array.from(atob(a),c=>c.charCodeAt(0));const data=Uint8Array.from(atob(b),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data));}
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));
 return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...data));
}
export async function setting(key:string,value?:string){
 if(value!==undefined){await supa('/rest/v1/rh_settings?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({key,value})});return value;}
 const rows=await supa('/rest/v1/rh_settings?select=value&key=eq.'+encodeURIComponent(key));return rows[0]?.value;
}
let tokenCache:{token:string;until:number}|undefined;
export async function dbxToken(){
 if(tokenCache&&Date.now()<tokenCache.until)return tokenCache.token;
 const c=config();if(!c.dbxKey||!c.dbxSecret)throw new PortalError(503,'Falta configurar la aplicación de Dropbox.');
 const stored=c.refresh||await setting('dropbox_refresh');const refresh=c.refresh?stored:stored?await encrypted(stored,true):null;
 if(!refresh)throw new PortalError(503,'Conecta Dropbox desde el panel de administración.');
 const r=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh,client_id:c.dbxKey,client_secret:c.dbxSecret})});
 const d=await r.json() as any;if(!r.ok||!d.access_token)throw new PortalError(503,'Dropbox necesita que vuelvas a autorizar la conexión.');
 tokenCache={token:d.access_token,until:Date.now()+Math.max(60,d.expires_in-120)*1000};return tokenCache.token;
}
export const headerJSON=(x:unknown)=>JSON.stringify(x).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
export async function dbx(path:string,args:any){
 const r=await fetch('https://api.dropboxapi.com/2/'+path,{method:'POST',headers:{Authorization:'Bearer '+await dbxToken(),'Content-Type':'application/json'},body:JSON.stringify(args)});
 const d=await r.json().catch(()=>({})) as any;
 if(!r.ok){if(r.status===429)throw new PortalError(429,'Dropbox está ocupado. Intenta de nuevo en unos minutos.');if(d.error_summary?.includes('not_found'))throw new DropboxNotFound();if(d.error_summary?.includes('conflict'))throw new PortalError(409,'Ya existe una carpeta o archivo con ese nombre en Dropbox.');throw new PortalError(400,d.error_summary?.includes('not_found')?'No se encontró la carpeta o el documento en Dropbox.':'Dropbox no pudo completar la operación.');}return d;
}
export async function content(path:string,args:any,body:BodyInit|null=null,range?:string){
 const h:Record<string,string>={Authorization:'Bearer '+await dbxToken(),'Dropbox-API-Arg':headerJSON(args),'Content-Type':'application/octet-stream'};
 if(range)h.Range=range;
 const r=await fetch('https://content.dropboxapi.com/2/'+path,{method:'POST',headers:h,body});
 if(!r.ok&&r.status!==416)throw new PortalError(r.status===429?429:502,'No se pudo transferir el archivo con Dropbox. Intenta nuevamente.');return r;
}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function storeIds(u:any):string[]{return Array.isArray(u?.app_metadata?.store_ids)?[...new Set((u.app_metadata.store_ids.filter(uuid) as string[]).map(v=>v.toLowerCase()))]:[];}
function quoteStoreIds(u:any,approve=false):string[]{const values=u?.app_metadata?.[approve?'quote_approve_store_ids':'quote_view_store_ids'];return Array.isArray(values)?[...new Set((values.filter(uuid) as string[]).map(v=>v.toLowerCase()))]:[];}
async function validateQuotePermissions(b:any,current:any={}){
 if(b.quote_approval===true)throw new PortalError(400,'Actualiza el portal y selecciona las tiendas donde podrá ver y autorizar cotizaciones.');
 const view=await validateStoreIds(b.quote_view_store_ids??quoteStoreIds({app_metadata:current}));
 const approve=await validateStoreIds(b.quote_approve_store_ids??quoteStoreIds({app_metadata:current},true));
 if(approve.some(id=>!view.includes(id)))throw new PortalError(400,'Para autorizar una tienda también debes permitir ver sus cotizaciones.');
 return {quote_view_store_ids:view,quote_approve_store_ids:approve,quote_approval:false};
}
function validStoreName(value:unknown){const name=typeof value==='string'?value.trim().normalize('NFC'):'';if(!name||name.length>100||/[\/\\\u0000-\u001f]/.test(name)||name==='.'||name==='..')throw new PortalError(400,'Escribe un nombre de tienda válido, sin diagonales.');return name;}
type Section='Planogramas'|'Listados';
const fileSection=(name:string):Section|null=>/\.pdf$/i.test(name)?'Planogramas':/\.(xlsx|xls)$/i.test(name)?'Listados':null;
function sectionName(value:unknown):Section|null{const v=typeof value==='string'?value.toLowerCase():'';return v==='planogramas'?'Planogramas':v==='listados'?'Listados':null;}
function sectionForPath(path:string,storePath:string,filename:string):Section|null{
 const prefix=storePath.toLowerCase()+'/';if(!path.toLowerCase().startsWith(prefix))return null;const parts=path.slice(prefix.length).split('/');if(parts.length<2)return null;
 const section=sectionName(parts[0]);return section&&section===fileSection(filename)?section:null;
}
const fileMime=(filename:string)=>/\.pdf$/i.test(filename)?'application/pdf':/\.xlsx$/i.test(filename)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.ms-excel';
async function ensureSectionFolders(folder:any){
 for(const section of ['planogramas','listados']){
 const path=folder.path_display+'/'+section;let info;
 try{info={...(await dbx('files/create_folder_v2',{path,autorename:false})).metadata,'.tag':'folder'};}
 catch(error){if(!(error instanceof PortalError)||error.status!==409)throw error;info=await dbx('files/get_metadata',{path});}
 if(info['.tag']!=='folder'||String(info.path_lower).toLowerCase()!==path.toLowerCase())throw new PortalError(400,'No se pudo preparar la carpeta '+section+'. Revisa si existe un archivo con ese nombre en Dropbox.');
 }
}
const safeStore=(s:any)=>({id:s.id,name:s.name,enabled:s.enabled});
function folderIsStore(e:any){const root=config().root.toLowerCase()+'/';return e?.['.tag']==='folder'&&String(e.path_lower||'').startsWith(root)&&!String(e.path_lower).slice(root.length).includes('/');}
async function saveStoreFolder(e:any){
 if(!folderIsStore(e))throw new PortalError(400,'La tienda debe ser una carpeta directamente dentro de Retail Hub/Portal.');
 const rows=await supa('/rest/v1/rh_stores?on_conflict=dropbox_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({dropbox_id:e.id,name:e.name,path_lower:e.path_lower,updated_at:new Date().toISOString()})});return rows[0];
}
async function requireStore(id:unknown,user:any,scope='library'){
 if(!uuid(id))throw new PortalError(404,'Tienda no disponible.');
 if(user.app_metadata.role!=='admin'&&!(scope==='quotes'?quoteStoreIds(user):storeIds(user)).includes(id))throw new PortalError(404,'Tienda no disponible.');
 const rows=await supa('/rest/v1/rh_stores?id=eq.'+id+'&select=id,name,dropbox_id,path_lower,enabled');const store=rows[0];
 if(!store||!store.enabled)throw new PortalError(404,'Tienda no disponible.');return store;
}
async function validateStoreIds(value:unknown){
 if(!Array.isArray(value)||value.length>100||value.some(v=>!uuid(v)))throw new PortalError(400,'Selecciona tiendas válidas (hasta 100 por usuario).');
 const ids=[...new Set((value as string[]).map(v=>v.toLowerCase()))];if(!ids.length)return ids;
 const rows=await supa('/rest/v1/rh_stores?select=id&id=in.('+ids.join(',')+')&enabled=eq.true');
 if(rows.length!==ids.length)throw new PortalError(400,'Alguna tienda ya no está disponible. Actualiza la lista.');return ids;
}
// Dashboard content is private per store. Only administrators may change it.
const dashboardStates=['Pendiente','En proceso','En revisión','Terminado','Bloqueado','No aplica'];
export function validateDashboard(value:unknown){
 if(!Array.isArray(value)||value.length>500)throw new PortalError(400,'El dashboard admite hasta 500 elementos.');
 const ids=new Set<string>();const items=value.map((v:any)=>{
 if(!v||typeof v!=='object'||!uuid(v.id)||ids.has(v.id))throw new PortalError(400,'Hay elementos duplicados o no válidos.');ids.add(v.id);
 const text=(key:string,max:number,required=false)=>{if(typeof v[key]!=='string'||v[key].length>max||(required&&!v[key].trim()))throw new PortalError(400,'Revisa el campo '+key+'.');return v[key].trim();};
 if(v.parent_id!==null&&!uuid(v.parent_id))throw new PortalError(400,'La etapa seleccionada no es válida.');
 if(!dashboardStates.includes(v.status))throw new PortalError(400,'Selecciona un estado válido.');
 const due=text('due',10);if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due+'T12:00:00Z'))||new Date(due+'T12:00:00Z').toISOString().slice(0,10)!==due))throw new PortalError(400,'La fecha objetivo no es válida.');
 return {id:v.id,parent_id:v.parent_id,title:text('title',300,true),status:v.status,owner:text('owner',120),due,notes:text('notes',2000)};
 });
 const byId=new Map(items.map(v=>[v.id,v]));
 for(const item of items){const seen=new Set([item.id]);let parent=item.parent_id,depth=1;while(parent!==null){const node=byId.get(parent);if(!node||seen.has(parent)||++depth>6)throw new PortalError(400,'La estructura debe tener hasta 6 niveles y no puede contener ciclos.');seen.add(parent);parent=node.parent_id;}}
 return items.map(v=>items.some(c=>c.parent_id===v.id)?{...v,status:'Pendiente'}:v);
}

export function cleanDashboardTemplate(value:unknown){
 const items=validateDashboard(value);const ids=new Map(items.map(v=>[v.id,crypto.randomUUID()]));
 return items.map(v=>({id:ids.get(v.id)!,parent_id:v.parent_id===null?null:ids.get(v.parent_id)!,title:v.title,status:'Pendiente',owner:'',due:'',notes:''}));
}
async function writeDashboard(storeId:string,uid:string,revision:any,items:any[]){
 const path='/rest/v1/rh_dashboards',fields='store_id,revision,items,updated_at';let rows;
 const now=new Date().toISOString();
 if(revision===null){
 // Ignore conflicts, never overwrite another administrator's initialized store.
 rows=await supa(path+'?on_conflict=store_id&select='+fields,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({store_id:storeId,revision:1,items,updated_at:now,updated_by:uid})});
 }else{
 if(!Number.isSafeInteger(revision)||revision<1||revision>=2147483647)throw new PortalError(400,'Versión del dashboard no válida.');
 // Compare-and-swap prevents silent lost updates across tabs/administrators.
 rows=await supa(path+'?store_id=eq.'+storeId+'&revision=eq.'+revision+'&select='+fields,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revision:revision+1,items,updated_at:now,updated_by:uid})});
 }
 if(!rows?.length)throw new PortalError(409,'Otro administrador modificó este dashboard. Pulsa Actualizar y vuelve a aplicar tu cambio.');
 return rows[0];
}

async function liveFolder(store:any){const folder=await dbx('files/get_metadata',{path:store.dropbox_id});if(!folderIsStore(folder))throw new PortalError(404,'La carpeta de esta tienda cambió. Sincroniza Dropbox.');return folder;}
export async function record(e:any,cache=new Map<string,any>()){
 const root=config().root.toLowerCase()+'/';const path=String(e.path_lower||'');
 if(!path.startsWith(root)||!fileSection(String(e.name)))return null;
 const parts=(e.path_display||e.path_lower).slice(config().root.length+1).split('/');
 // Files must be in a store and its matching fixed section.
 if(parts.length<3)return null;
 const section=sectionName(parts[1]);if(!section||section!==fileSection(e.name))return null;
 const storePath=root+path.slice(root.length).split('/')[0];let store=cache.get(storePath);
 if(!store){const folder=await dbx('files/get_metadata',{path:storePath});store=await saveStoreFolder(folder);if(store.enabled)await ensureSectionFolders(folder);cache.set(storePath,store);}
 return {store_id:store.id,dropbox_id:e.id,title:e.name.replace(/\.(pdf|xlsx|xls)$/i,'').replace(/_/g,' '),filename:e.name,category:section,size:e.size,revision:e.rev,modified_at:e.server_modified,updated_at:new Date().toISOString()};
}
export async function syncBatch(cursor?:string){
 const c=config();if(!c.root.startsWith('/')||c.root==='/')throw new PortalError(503,'Selecciona una carpeta dedicada para el portal.');
 const d=await dbx(cursor?'files/list_folder/continue':'files/list_folder',cursor?{cursor}:{path:c.root,recursive:true,include_deleted:false,limit:50});
 const cache=new Map<string,any>();
 for(const e of d.entries)if(folderIsStore(e)){const store=await saveStoreFolder(e);if(store.enabled)await ensureSectionFolders(e);cache.set(e.path_lower,store);}
 const rows=[];let skipped=0;for(const e of d.entries)if(e['.tag']==='file'){const row=await record(e,cache);if(row)rows.push(row);else if(fileSection(String(e.name)))skipped++;}
 if(rows.length)await supa('/rest/v1/rh_documents?on_conflict=dropbox_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});
 return {count:rows.length,skipped,cursor:d.has_more?d.cursor:null};
}

async function seal(type:string,value:Record<string,unknown>){return encrypted(JSON.stringify({...value,type}));}
async function unseal(type:string,value:string){try{const data=JSON.parse(await encrypted(value,true));if(data.type!==type||!Number.isFinite(data.expires)||data.expires<Date.now())throw Error();return data;}catch{throw new PortalError(403,'La autorización venció. Vuelve a intentarlo.');}}
async function digest(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');}
const endpoint=(r:Request)=>config().url+'/functions/v1/retailhub-api';
async function documentRecord(id:string,user:any){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new PortalError(404,'Documento no encontrado.');
 const rows=await supa('/rest/v1/rh_documents?id=eq.'+id+'&select=dropbox_id,filename,published,store_id,category');const d=rows[0];
 if(!d||(!d.published&&user.app_metadata.role!=='admin'))throw new PortalError(404,'Documento no disponible.');
 const store=await requireStore(d.store_id,user);
 // Re-check Dropbox location: a moved file must not inherit its former store's access.
 const [folder,file]=await Promise.all([liveFolder(store),dbx('files/get_metadata',{path:d.dropbox_id})]);
 const section=sectionForPath(String(file.path_lower||''),folder.path_lower,String(file.name));
 if(file['.tag']!=='file'||!section||section!==sectionName(d.category))throw new PortalError(404,'Archivo no disponible en esta sección. Sincroniza Dropbox.');return {...d,filename:file.name,category:section};
}
// Expiring settings records contain only ticket hashes, never readable file links.
let cleanedAt=0;
async function transient(key:string,data:any){
 await setting(key,JSON.stringify(data));
 if(Date.now()-cleanedAt>3600000){cleanedAt=Date.now();
 const rows=await supa('/rest/v1/rh_settings?or=(key.like.file:*,key.like.oauth:*)&select=key,value&limit=100').catch(()=>[]);
 for(const row of rows){try{if(JSON.parse(row.value).expires<Date.now())await supa('/rest/v1/rh_settings?key=eq.'+encodeURIComponent(row.key),{method:'DELETE'});}catch{}}
 }

}
async function ticketUser(r:Request,id:string){
 const token=new URL(r.url).searchParams.get('ticket');if(!token)return requireUser(r);
 if(token.length>100)throw new PortalError(403,'Enlace no válido.');
 const saved=await setting('file:'+await digest(token));let data:any;
 try{data=JSON.parse(saved||'null');}catch{}
 if(!data||data.doc!==id||data.expires<Date.now())throw new PortalError(403,'El enlace venció. Abre otra vez el documento.');
 return membership(await supa('/auth/v1/admin/users/'+data.uid));
}

export type QRequest={id:string;title:string;material:string;width:string;height:string;quantity:number|null;unit:string;group:string;details?:string;attributes?:string};
export type QLine={id:string;request_id:string|null;description:string;material:string;width:string;height:string;quantity:number|null;amount:number|null;review:'pending'|'confirmed'|'clarify';note:string;attributes?:string};
export type QOffer={id:string;supplier:string;lead_days:number|null;lead_basis:string;terms:string;source:string;reported_subtotal:number|null;tax_bp:number;shipping:number|null;lines:QLine[]};
export type QData={title:string;requests:QRequest[];offers:QOffer[];notes:string;currency?:string};
export const qNormalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function qIssues(request:QRequest,line:QLine){const issues:string[]=[];if(request.attributes!==undefined&&line.attributes!==undefined&&qNormalize(request.attributes)!==qNormalize(line.attributes))issues.push('Características distintas');if(line.quantity!==request.quantity)issues.push('Cantidad distinta o sin confirmar');if(line.material&&qNormalize(line.material)!==qNormalize(request.material))issues.push('Material distinto');if(line.width&&line.width!==request.width||line.height&&line.height!==request.height)issues.push('Medidas distintas');return issues;}
export function qTotals(data:QData,offer:QOffer){
 const priced=offer.lines.filter(l=>l.amount!==null);const subtotal=priced.reduce((n,l)=>n+l.amount!,0),tax=Math.round(subtotal*offer.tax_bp/10000),total=subtotal+tax+(offer.shipping??0);
 const covered=new Set(priced.filter(l=>l.request_id).map(l=>l.request_id));const missing=data.requests.filter(r=>!covered.has(r.id));
 const errors:string[]=[];if(data.requests.some(r=>covered.has(r.id)&&r.quantity===null))errors.push('Hay cantidades de referencia por confirmar');if(data.requests.some(r=>covered.has(r.id)&&(r.width||r.height)&&(!r.unit.trim()||/confirmar|pendiente/i.test(r.unit))))errors.push('Unidades de medida por confirmar');if(offer.shipping===null)errors.push('Envío por confirmar');if(offer.lines.some(l=>l.quantity===null))errors.push('Hay cantidades por confirmar');if(!priced.length)errors.push('Sin conceptos con precio');if(offer.lines.some(l=>l.amount===null))errors.push('Hay conceptos sin importe');
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
 const requests:QRequest[]=value.requests.map((r:any)=>({id:unique(r.id),title:text(r.title,300,true),material:text(r.material,200),width:text(r.width,30),height:text(r.height,30),quantity:r.quantity===null?null:num(r.quantity,0.0001,1000000),unit:text(r.unit,60),group:text(r.group,100),...(r.details!==undefined?{details:text(r.details,20000)}:{}),...(r.attributes!==undefined?{attributes:text(r.attributes,20000)}:{})}));
 const requestIds=new Set(requests.map(r=>r.id));
 const offers:QOffer[]=value.offers.map((o:any)=>{if(!Array.isArray(o.lines)||o.lines.length>400)fail('Máximo 400 renglones por proveedor.');const mapped=new Set<string>();
 const lines:QLine[]=o.lines.map((l:any)=>{const ref=l.request_id===null?null:id(l.request_id);if(ref&&(!requestIds.has(ref)||mapped.has(ref)))fail('Cada renglón debe corresponder a un concepto distinto de la solicitud.');if(ref)mapped.add(ref);if(!['pending','confirmed','clarify'].includes(l.review))fail('Estado de revisión no válido.');return {id:unique(l.id),request_id:ref,description:text(l.description,500,true),material:text(l.material,200),width:text(l.width,30),height:text(l.height,30),quantity:l.quantity===null?null:num(l.quantity,0.0001,1000000),amount:l.amount===null?null:cents(l.amount),review:l.review,note:text(l.note,22000),...(l.attributes!==undefined?{attributes:text(l.attributes,20000)}:{})};});
 return {id:unique(o.id),supplier:text(o.supplier,150,true),lead_days:o.lead_days===null?null:num(o.lead_days,0,1000),lead_basis:text(o.lead_basis,200),terms:text(o.terms,2000),source:text(o.source,200),reported_subtotal:o.reported_subtotal===null?null:cents(o.reported_subtotal),tax_bp:num(o.tax_bp,0,10000),shipping:o.shipping===null?null:cents(o.shipping),lines};});
 return {title:text(value.title,200,true),notes:text(value.notes,3000),requests,offers,currency:value.currency===undefined?'MXN':['MXN','USD','EUR'].includes(value.currency)?value.currency:fail('Moneda no válida.')};
}

function checkedQuote(value:any){try{return validateQData(value);}catch(e){throw new PortalError(400,(e as Error).message);}}

async function quoteBoardFor(id:unknown,user:any){if(!uuid(id))throw new PortalError(404,'Comparativo no disponible.');const rows=await supa('/rest/v1/rh_quote_boards?id=eq.'+id+'&deleted_at=is.null&select=id,store_id,published');const board=rows[0];if(!board||!board.published&&user.app_metadata.role!=='admin')throw new PortalError(404,'Comparativo no disponible.');const store=await requireStore(board.store_id,user,'quotes');return {board,store};}
async function quoteFileFor(id:string,user:any){if(!uuid(id))throw new PortalError(404,'Respaldo no disponible.');const rows=await supa('/rest/v1/rh_quote_files?id=eq.'+id+'&select=id,board_id,document_id,dropbox_id,filename,revision');const file=rows[0];if(!file)throw new PortalError(404,'Respaldo no disponible.');const {store}=file.document_id?{store:await requireStore((await quoteRecordFor(file.document_id,user)).store_id,user,'quotes')}:await quoteBoardFor(file.board_id,user);const [folder,meta]=await Promise.all([liveFolder(store),dbx('files/get_metadata',{path:file.dropbox_id})]);if(meta['.tag']!=='file'||meta.rev!==file.revision||!String(meta.path_lower||'').startsWith(folder.path_lower+'/cotizaciones/'))throw new PortalError(404,'El respaldo cambió de ubicación.');return file;}

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
export function recordAmount(d:QuoteRecordData,r:RecordRow){const total=recordNumber(recordCell(d,r,'amount'));if(d.columns.some(c=>c.role==='amount'))return total===null?null:Math.round(total*100);const price=recordNumber(recordCell(d,r,'unit_price')),qty=recordNumber(recordCell(d,r,'quantity'));return price===null||qty===null?null:Math.round(price*qty*100);}
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

async function quoteRecordFor(id:unknown,user:any){membership(user,true);if(!uuid(id))throw new PortalError(404,'Cotización no disponible.');const rows=await supa('/rest/v1/rh_quote_records?id=eq.'+id+'&deleted_at=is.null&select=id,store_id,kind,title,revision,data,updated_at');if(!rows[0])throw new PortalError(404,'Cotización no disponible.');await requireStore(rows[0].store_id,user,'quotes');return rows[0];}

export async function handle(r:Request){
 try{
 const segments=new URL(r.url).pathname.split('/').filter(Boolean);const index=segments.indexOf('retailhub-api');const p=index>=0?segments.slice(index+1):segments;const route=p.join('/'); const method=r.method;
 if(method==='OPTIONS'){sameOrigin(r);return new Response(null,{status:204,headers:cors});}
 if(method!=='GET')sameOrigin(r);
 if(route==='status'&&method==='GET')return json({version:API_VERSION,build:API_BUILD,features:{deleteStores:true,editStores:true,storeSections:true,deleteDocuments:true,storeDashboard:true,dashboardTemplates:true,quotes:true,quotePermissions:true,quoteTools:true,quoteRecords:true},auth:authReady(),dropboxApp:!!(config().dbxKey&&config().dbxSecret),root:authReady()?undefined:null});
 if(route==='login'&&method==='POST'){
 const b:any=await bodyJSON(r);if(typeof b.password!=='string'||b.password.length>256)throw new PortalError(400,'Revisa tu usuario y contraseña.');
 let data:any;
 try{data=await supa('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email(b.username),password:b.password})},config().anon);}catch(e){if(e instanceof PortalError&&e.status!==429&&e.status!==503)throw new PortalError(401,'Usuario o contraseña incorrectos.');throw e;}
 if(!data.user?.app_metadata?.rh_portal||data.user?.app_metadata?.disabled)throw new PortalError(403,'Este usuario no tiene acceso al portal.');
 return json(sessionData(data));}
 if(route==='refresh'&&method==='POST'){
 const b=await bodyJSON(r);const t=typeof b.refresh_token==='string'&&b.refresh_token.length<4096?b.refresh_token:'';if(!t)throw new PortalError(401,'Vuelve a iniciar sesión.');
 const d=await supa('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:t})},config().anon);
 if(!d.user?.app_metadata?.rh_portal||d.user?.app_metadata?.disabled)throw new PortalError(403,'Acceso desactivado.');
 return json(sessionData(d));}
 if(route==='logout'&&method==='POST'){
 const t=bearer(r);if(t)await supa('/auth/v1/logout?scope=local',{method:'POST'},t).catch(()=>{});
 return json({ok:true});}
 // OAuth callback and short-lived file tickets authenticate independently.
 if(route==='dropbox/callback'&&method==='GET'){
 const u=new URL(r.url);const state=await unseal('oauth',u.searchParams.get('state')||'');
 const rows=await supa('/rest/v1/rh_settings?key=eq.'+encodeURIComponent('oauth:'+state.nonce),{method:'DELETE',headers:{Prefer:'return=representation'}});
 if(!rows?.length)throw new PortalError(403,'La autorización ya se utilizó o venció.');
 membership(await supa('/auth/v1/admin/users/'+state.uid),true);
 if(!u.searchParams.get('code'))throw new PortalError(400,'No se autorizó Dropbox.');
 const c=config();const result=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',body:new URLSearchParams({code:u.searchParams.get('code')!,grant_type:'authorization_code',client_id:c.dbxKey!,client_secret:c.dbxSecret!,redirect_uri:endpoint(r)+'/dropbox/callback'})});
 const data=await result.json();if(!result.ok||!data.refresh_token)throw new PortalError(400,'No se pudo finalizar la autorización de Dropbox.');
 await setting('dropbox_refresh',await encrypted(data.refresh_token));tokenCache=undefined;
 return new Response(null,{status:302,headers:{...cors,Location:FRONTEND+'?conexion=dropbox','Cache-Control':'no-store'}});}
 if(p[0]==='documents'&&p[1]&&p[2]==='file'&&method==='GET'){
 const user=await ticketUser(r,p[1]);const d=await documentRecord(p[1],user);
 const range=r.headers.get('range');if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))throw new PortalError(416,'Rango no válido.');
 const upstream=await content('files/download',{path:d.dropbox_id},null,range||undefined);
 const headers=new Headers({...cors,'Content-Type':fileMime(d.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes','Content-Disposition':`${d.category==='Listados'||new URL(r.url).searchParams.has('download')?'attachment':'inline'}; filename="documento.${d.filename.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(d.filename).replace(/'/g,'%27')}`});
 for(const k of ['content-length','content-range'])if(upstream.headers.has(k))headers.set(k,upstream.headers.get(k)!);
 return new Response(upstream.body,{status:upstream.status,headers});}
 if(p[0]==='quote-files'&&p.length===3&&p[2]==='file'&&method==='GET'){
 const token=new URL(r.url).searchParams.get('ticket')||'';if(!token||token.length>100)throw new PortalError(403,'Enlace no válido.');let saved:any;try{saved=JSON.parse(await setting('file:'+await digest(token))||'null');}catch{}
 if(!saved||saved.qfile!==p[1]||saved.expires<Date.now())throw new PortalError(403,'El enlace venció. Abre otra vez el respaldo.');const caller=membership(await supa('/auth/v1/admin/users/'+saved.uid));const file=await quoteFileFor(p[1],caller);const upstream=await content('files/download',{path:file.dropbox_id});return new Response(upstream.body,{headers:{...cors,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename).replace(/'/g,'%27'),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }
 const admin=['users','sync','connections','upload','dropbox'].includes(p[0]); const user=await requireUser(r,admin);
 if(route==='me'&&method==='GET')return json({user:safeUser(user)});
 if(route==='stores'&&method==='GET'){
 const scope=new URL(r.url).searchParams.get('scope');if(scope&&scope!=='quotes')throw new PortalError(400,'Ámbito de tiendas no válido.');const ids=scope==='quotes'?quoteStoreIds(user):storeIds(user);if(user.app_metadata.role!=='admin'&&!ids.length)return json({stores:[]});
 const filter=user.app_metadata.role==='admin'?'':'&id=in.('+ids.join(',')+')';
 return json({stores:(await supa('/rest/v1/rh_stores?select=id,name,enabled&enabled=eq.true&order=name.asc&limit=1000'+filter)).map(safeStore)});}
 if(route==='stores'&&method==='POST'){
 await requireUser(r,true);const b=await bodyJSON(r);const name=validStoreName(b.name);
 const path=config().root+'/'+name;let folder;
 // create_folder_v2 returns concrete FolderMetadata, without the union .tag.
 try{folder={...(await dbx('files/create_folder_v2',{path,autorename:false})).metadata,'.tag':'folder'};}catch{folder=await dbx('files/get_metadata',{path});}
 const store=await saveStoreFolder(folder);if(!store.enabled)throw new PortalError(409,'La carpeta pertenece a una tienda retirada del portal. Usa otro nombre.');await ensureSectionFolders(folder);return json({store:safeStore(store)},201);}
 if(p[0]==='stores'&&p.length===2&&method==='PATCH'){
 await requireUser(r,true);const store=await requireStore(p[1],user);const b=await bodyJSON(r);const name=validStoreName(b.name);let folder=await liveFolder(store);
 if(folder.name!==name){
 const target=config().root+'/'+name;const original=folder.path_display;
 // Dropbox does not support case-only moves. Use a unique intermediate folder
 // name in the same root, and restore the original name if the second move fails.
 const caseOnly=folder.path_lower===target.toLowerCase();
 if(caseOnly)await dbx('files/move_v2',{from_path:store.dropbox_id,to_path:config().root+'/.rh-rename-'+crypto.randomUUID(),autorename:false});
 try{await dbx('files/move_v2',{from_path:store.dropbox_id,to_path:target,autorename:false});}
 catch(error){if(caseOnly)await dbx('files/move_v2',{from_path:store.dropbox_id,to_path:original,autorename:false}).catch(()=>{});throw error;}
 folder=await liveFolder(store);
 }
 const updated=await saveStoreFolder(folder);if(!updated.enabled)throw new PortalError(404,'Tienda no disponible.');return json({store:safeStore(updated)});}
 if(p[0]==='stores'&&p.length===2&&method==='DELETE'){
 await requireUser(r,true);const store=await requireStore(p[1],user);const b=await bodyJSON(r);
 if(b.confirm_name!==store.name)throw new PortalError(400,'Escribe el nombre exacto de la tienda para confirmar.');
 // Retire from the portal, never delete Dropbox content. Sync omits enabled and
 // therefore cannot republish this store or reactivate its former assignments.
 await supa('/rest/v1/rh_stores?id=eq.'+store.id,{method:'PATCH',body:JSON.stringify({enabled:false,updated_at:new Date().toISOString()})});
 return json({ok:true});}
 if(p[0]==='quote-files'){
 if(p.length===3&&p[2]==='link'&&method==='POST'){await quoteFileFor(p[1],user);const token=crypto.randomUUID()+crypto.randomUUID();await transient('file:'+await digest(token),{qfile:p[1],uid:user.id,expires:Date.now()+900000});return json({url:endpoint(r)+'/quote-files/'+p[1]+'/file?ticket='+token});}
 membership(user,true);
 if(route==='quote-files/start'&&method==='POST'){
 const b=await bodyJSON(r);const {board,store}=b.document_id?{board:{id:null},store:await requireStore((await quoteRecordFor(b.document_id,user)).store_id,user,'quotes')}:await quoteBoardFor(b.board_id,user);const name=typeof b.filename==='string'?b.filename.normalize('NFC'):'';
 if(!name||name.length>150||/[\/\\\u0000-\u001f]/.test(name)||!/^.+\.(pdf|xlsx|csv|tsv|txt|png|jpe?g)$/i.test(name)||!Number.isSafeInteger(b.size)||b.size<1||b.size>20000000)throw new PortalError(400,'Adjunta PDF, XLSX, CSV, TSV, TXT, PNG o JPG de hasta 20 MB.');
 const folder=await liveFolder(store),path=folder.path_display+'/cotizaciones';try{await dbx('files/create_folder_v2',{path,autorename:false});}catch(e){if(!(e instanceof PortalError)||e.status!==409)throw e;const existing=await dbx('files/get_metadata',{path});if(existing['.tag']!=='folder')throw new PortalError(400,'La carpeta de cotizaciones no está disponible.');}
 const id=crypto.randomUUID(),upstream=await content('files/upload_session/start',{close:false},new Uint8Array());const d=await upstream.json();const ticket=await seal('quote-upload',{id,uid:user.id,board_id:board.id,document_id:b.document_id||null,store_id:store.id,filename:name,size:b.size,sid:d.session_id,path:path+'/'+id+'_'+name,expires:Date.now()+3600000});return json({ticket});
 }
 if((route==='quote-files/chunk'||route==='quote-files/finish')&&method==='POST'){
 const t=await unseal('quote-upload',r.headers.get('X-Upload-Ticket')||'');if(t.uid!==user.id)throw new PortalError(403,'Sesión de carga no válida.');const {store}=t.document_id?{store:await requireStore((await quoteRecordFor(t.document_id,user)).store_id,user,'quotes')}:await quoteBoardFor(t.board_id,user);const folder=await liveFolder(store);if(!String(t.path).toLowerCase().startsWith(folder.path_lower+'/cotizaciones/'))throw new PortalError(409,'La tienda cambió. Inicia otra vez la carga.');const offset=Number(r.headers.get('X-Upload-Offset'));if(!Number.isSafeInteger(offset)||offset<0||offset>t.size)throw new PortalError(400,'Posición de carga no válida.');
 const bytes=await bounded(r,8*1024*1024);if(offset+bytes.length>t.size)throw new PortalError(413,'El respaldo supera el tamaño esperado.');
 if(route==='quote-files/chunk'){await content('files/upload_session/append_v2',{cursor:{session_id:t.sid,offset},close:false},bytes);return json({ok:true});}
 if(offset!==t.size||bytes.length)throw new PortalError(400,'La carga está incompleta.');
 let meta:any;try{meta=await dbx('files/get_metadata',{path:t.path});}catch(error){if(!(error instanceof DropboxNotFound))throw error;}if(!meta){const response=await content('files/upload_session/finish',{cursor:{session_id:t.sid,offset},commit:{path:t.path,mode:'add',autorename:false,mute:false}},new Uint8Array());meta=await response.json();}if(meta['.tag']!=='file'||typeof meta.rev!=='string')throw new PortalError(409,'El destino del respaldo no es un archivo.');await supa('/rest/v1/rh_quote_files?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({id:t.id,board_id:t.board_id,document_id:t.document_id||null,dropbox_id:meta.id,revision:meta.rev,filename:t.filename})});return json({ok:true});
 }
 throw new PortalError(404,'Ruta no encontrada.');
 }
 if(p[0]==='quote-suppliers'){
 membership(user,true);const fields='id,name,defaults,revision,updated_at';
 if(route==='quote-suppliers'&&method==='GET'){const before=new URL(r.url).searchParams.get('before');if(before&&!uuid(before))throw new PortalError(400,'Página no válida.');const rows=await supa('/rest/v1/rh_quote_suppliers?select='+fields+'&order=id.desc&limit=100'+(before?'&id=lt.'+before:''));return json({suppliers:rows,next:rows.length===100?rows.at(-1).id:null});}
 if(route==='quote-suppliers'&&method==='POST'||p.length===2&&method==='PATCH'){
 const b=await bodyJSON(r),name=typeof b.name==='string'?b.name.trim():'';const nameKey=recordKey(name);if(!name||name.length>150||!nameKey)throw new PortalError(400,'Escribe el nombre del proveedor.');
 let defaults:any;try{const v=validateQuoteRecord({title:name,type:'quote',supplier_id:null,supplier:name,columns:[{id:'d',label:'Concepto',role:'description'}],rows:[],source:'',notes:'',...b.defaults});defaults={lead_days:v.lead_days,lead_basis:v.lead_basis,terms:v.terms,tax_bp:v.tax_bp,shipping:v.shipping,currency:v.currency};}catch(e){throw new PortalError(400,(e as Error).message);}
 if(method==='POST'){await supa('/rest/v1/rh_quote_suppliers?on_conflict=name_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({name,name_key:nameKey,defaults,created_by:user.id})});const rows=await supa('/rest/v1/rh_quote_suppliers?name_key=eq.'+nameKey+'&select='+fields);return json({supplier:rows[0]},201);}
 if(!uuid(p[1])||!Number.isSafeInteger(b.revision)||b.revision<1)throw new PortalError(400,'Revisa la versión del proveedor.');
 const rows=await supa('/rest/v1/rh_quote_suppliers?id=eq.'+p[1]+'&revision=eq.'+b.revision+'&select='+fields,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({defaults,revision:b.revision+1,updated_at:new Date().toISOString()})});if(!rows.length)throw new PortalError(409,'El proveedor cambió. Actualiza la lista.');return json({supplier:rows[0]});
 }
 throw new PortalError(404,'Ruta no encontrada.');
 }
 if(p[0]==='quote-records'){
 membership(user,true);const fields='id,store_id,kind,title,revision,updated_at';
 if(route==='quote-records'&&method==='GET'){const params=new URL(r.url).searchParams,store=await requireStore(params.get('store'),user,'quotes'),before=params.get('before');if(before&&!uuid(before))throw new PortalError(400,'Página no válida.');const rows=await supa('/rest/v1/rh_quote_records?store_id=eq.'+store.id+'&deleted_at=is.null&select='+fields+',supplier:data->>supplier,type:data->>type&order=id.desc&limit=100'+(before?'&id=lt.'+before:''));return json({records:rows,next:rows.length===100?rows.at(-1).id:null});}
 if(route==='quote-records'&&method==='POST'||p.length===2&&method==='PATCH'){
 const b=await bodyJSON(r,2097152);let current:any;
 if(method==='PATCH'){current=await quoteRecordFor(p[1],user);if(b.kind!==current.kind||b.store_id!==current.store_id)throw new PortalError(400,'No puedes cambiar el tipo o la tienda del registro.');if(!Number.isSafeInteger(b.revision)||b.revision<1)throw new PortalError(400,'Revisa la versión del registro.');}
 const store=await requireStore(b.store_id,user,'quotes');if(!['quote','request','template','comparison-template'].includes(b.kind))throw new PortalError(400,'Tipo de registro no válido.');let data:QuoteRecordData;try{data=validateQuoteRecord(b.data,b.kind==='template');}catch(e){throw new PortalError(400,(e as Error).message);}
 if((b.kind==='quote'||b.kind==='request')&&data.type!==b.kind)throw new PortalError(400,'El tipo de documento no coincide.');
 if(data.supplier_id){const suppliers=await supa('/rest/v1/rh_quote_suppliers?id=eq.'+data.supplier_id+'&select=id,name');if(!suppliers[0]||suppliers[0].name!==data.supplier)throw new PortalError(400,'Selecciona el proveedor guardado o registra uno nuevo.');}
 const value={store_id:store.id,kind:b.kind,title:data.title,data,revision:current?b.revision+1:1,updated_at:new Date().toISOString()};
 const rows=await supa('/rest/v1/rh_quote_records?'+(current?'id=eq.'+current.id+'&deleted_at=is.null&revision=eq.'+b.revision+'&':'')+'select='+fields+',data',{method:current?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(current?value:{...value,created_by:user.id})});if(!rows.length)throw new PortalError(409,'El registro cambió. Vuelve a abrirlo antes de editar.');return json({record:rows[0]},current?200:201);
 }
 if(p.length===2&&method==='GET'){const record=await quoteRecordFor(p[1],user);const files=await supa('/rest/v1/rh_quote_files?document_id=eq.'+record.id+'&select=id,filename&order=created_at.asc');return json({record,files});}
 if(p.length===2&&method==='DELETE'){const record=await quoteRecordFor(p[1],user),b=await bodyJSON(r);if(b.revision!==record.revision||b.confirm_title!==record.title)throw new PortalError(409,'Confirma el nombre y versión actuales.');const rows=await supa('/rest/v1/rh_quote_records?id=eq.'+record.id+'&revision=eq.'+b.revision+'&deleted_at=is.null&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({deleted_at:new Date().toISOString(),revision:b.revision+1})});if(!rows.length)throw new PortalError(409,'El registro cambió. Actualiza la lista.');return json({ok:true});}
 throw new PortalError(404,'Ruta no encontrada.');
 }

 if(p[0]==='quote-templates'){
 membership(user,true);const fields='id,name,revision,request_count,created_at,updated_at';
 if(route==='quote-templates'&&method==='GET'){
 const before=new URL(r.url).searchParams.get('before');if(before&&!uuid(before))throw new PortalError(400,'Página de machotes no válida.');
 const rows=await supa('/rest/v1/rh_quote_templates?deleted_at=is.null&select='+fields+'&order=id.desc&limit=100'+(before?'&id=lt.'+before:''));return json({templates:rows,next:rows.length===100?rows.at(-1).id:null});
 }
 if(route==='quote-templates'&&method==='POST'||p.length===2&&method==='PATCH'){
 if(method==='PATCH'&&!uuid(p[1]))throw new PortalError(404,'Machote no disponible.');
 const b=await bodyJSON(r,2097152);const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>100)throw new PortalError(400,'Escribe un nombre de hasta 100 caracteres para el machote.');
 const data=checkedQuote({title:name,notes:'',offers:[],requests:b.requests});if(!data.requests.length)throw new PortalError(400,'Agrega al menos un concepto para guardar un machote.');
 const requests=data.requests.map(v=>({...v,id:crypto.randomUUID()}));
 if(method==='POST'){const rows=await supa('/rest/v1/rh_quote_templates?select='+fields,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,requests,request_count:requests.length,created_by:user.id,revision:1})});return json({template:rows[0]},201);}
 if(!Number.isSafeInteger(b.revision)||b.revision<1||b.confirm_replace!==true)throw new PortalError(400,'Confirma que deseas actualizar este machote.');
 const rows=await supa('/rest/v1/rh_quote_templates?id=eq.'+p[1]+'&deleted_at=is.null&revision=eq.'+b.revision+'&select='+fields,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({name,requests,request_count:requests.length,revision:b.revision+1,updated_at:new Date().toISOString()})});if(!rows.length)throw new PortalError(409,'El machote cambió. Vuelve a abrir la lista.');return json({template:rows[0]});
 }
 if(p.length===2&&uuid(p[1])&&method==='GET'){
 const rows=await supa('/rest/v1/rh_quote_templates?id=eq.'+p[1]+'&deleted_at=is.null&select='+fields+',requests');if(!rows[0])throw new PortalError(404,'Machote no disponible.');return json({template:rows[0]});
 }
 if(p.length===2&&uuid(p[1])&&method==='DELETE'){
 const b=await bodyJSON(r);const rows=await supa('/rest/v1/rh_quote_templates?id=eq.'+p[1]+'&deleted_at=is.null&select=name,revision');if(!rows[0])throw new PortalError(404,'Machote no disponible.');if(b.confirm_name!==rows[0].name||b.revision!==rows[0].revision)throw new PortalError(409,'Confirma el nombre y la versión actual del machote.');
 const deleted=await supa('/rest/v1/rh_quote_templates?id=eq.'+p[1]+'&deleted_at=is.null&revision=eq.'+b.revision+'&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({deleted_at:new Date().toISOString(),revision:b.revision+1})});if(!deleted.length)throw new PortalError(409,'El machote cambió. Vuelve a abrir la lista.');return json({ok:true});
 }
 throw new PortalError(404,'Ruta no encontrada.');
 }
 if(p[0]==='quote-boards'){
 const fields='id,store_id,title,revision,published,data,updated_at';
 if(route==='quote-boards'&&method==='GET'){
 const store=await requireStore(new URL(r.url).searchParams.get('store'),user,'quotes');
 return json({boards:await supa('/rest/v1/rh_quote_boards?store_id=eq.'+store.id+'&deleted_at=is.null&select=id,title,revision,published,updated_at&order=updated_at.desc&limit=200'+(user.app_metadata.role==='admin'?'':'&published=eq.true'))});
 }
 if(route==='quote-boards'&&method==='POST'){
 membership(user,true);const b=await bodyJSON(r,2097152);const store=await requireStore(b.store_id,user,'quotes');const data=checkedQuote(b.data);
 if(b.source_records!==undefined){if(!Array.isArray(b.source_records)||!b.source_records.length||b.source_records.length>11||b.source_records.some((v:any)=>!uuid(v.id)||!Number.isSafeInteger(v.revision)||v.revision<1)||new Set(b.source_records.map((v:any)=>v.id)).size!==b.source_records.length)throw new PortalError(400,'Revisa las cotizaciones elegidas.');const id=await supa('/rest/v1/rpc/rh_create_record_comparison',{method:'POST',body:JSON.stringify({p_store:store.id,p_data:data,p_sources:b.source_records,p_user:user.id})});const saved=await supa('/rest/v1/rh_quote_boards?id=eq.'+id+'&select='+fields);return json({board:saved[0]},201);}
 const rows=await supa('/rest/v1/rh_quote_boards?select='+fields,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({store_id:store.id,title:data.title,data,published:false,revision:1})});return json({board:rows[0]},201);
 }
 if(!uuid(p[1]))throw new PortalError(404,'Comparativo no disponible.');
 const rows=await supa('/rest/v1/rh_quote_boards?id=eq.'+p[1]+'&deleted_at=is.null&select='+fields);const board=rows[0];if(!board||(!board.published&&user.app_metadata.role!=='admin'))throw new PortalError(404,'Comparativo no disponible.');await requireStore(board.store_id,user,'quotes');
 if(p.length===4&&p[2]==='approvals'&&method==='GET'){
 if(!uuid(p[3]))throw new PortalError(404,'Autorización no disponible.');const rows=await supa('/rest/v1/rh_quote_approvals?board_id=eq.'+board.id+'&id=eq.'+p[3]+'&select=id,board_revision,offer_id,approved_name,approved_at,snapshot');if(!rows[0])throw new PortalError(404,'Autorización no disponible.');return json({approval:rows[0]});
 }
 if(p.length===2&&method==='GET'){
 const approvals=await supa('/rest/v1/rh_quote_approvals?board_id=eq.'+board.id+'&select=id,board_revision,offer_id,approved_name,approved_at&order=approved_at.desc');const files=await supa('/rest/v1/rh_quote_files?board_id=eq.'+board.id+'&select=id,filename,created_at&order=created_at.asc');return json({board,approvals,files});
 }
 if(p.length===2&&method==='DELETE'){
 membership(user,true);const b=await bodyJSON(r);if(b.confirm_title!==board.title)throw new PortalError(400,'Confirma el nombre del comparativo.');if(b.revision!==board.revision)throw new PortalError(409,'El comparativo cambió. Actualiza antes de eliminar.');
 await supa('/rest/v1/rpc/rh_remove_quote',{method:'POST',body:JSON.stringify({p_board:board.id,p_revision:board.revision,p_user:user.id})});return json({ok:true});
 }
 if(p.length===2&&method==='PATCH'){
 membership(user,true);const b=await bodyJSON(r,2097152);if(!Number.isSafeInteger(b.revision)||b.revision!==board.revision)throw new PortalError(409,'El comparativo cambió. Actualiza antes de editar.');const data=checkedQuote(b.data);
 const updated=await supa('/rest/v1/rh_quote_boards?id=eq.'+board.id+'&deleted_at=is.null&revision=eq.'+b.revision+'&select='+fields,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data,title:data.title,published:false,revision:b.revision+1,updated_at:new Date().toISOString()})});
 if(!updated?.length)throw new PortalError(409,'El comparativo cambió. Actualiza antes de editar.');return json({board:updated[0]});
 }
 if(p.length===3&&p[2]==='publish'&&method==='POST'){
 membership(user,true);const b=await bodyJSON(r);if(b.revision!==board.revision)throw new PortalError(409,'El comparativo cambió. Actualiza antes de publicar.');
 if(!board.data.requests?.length||!board.data.offers?.length)throw new PortalError(400,'Agrega la solicitud y al menos un proveedor.');
 const updated=await supa('/rest/v1/rh_quote_boards?id=eq.'+board.id+'&deleted_at=is.null&revision=eq.'+b.revision+'&select='+fields,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({published:true})});if(!updated?.length)throw new PortalError(409,'El comparativo cambió. Actualiza antes de publicar.');return json({board:updated[0]});
 }
 if(p.length===3&&p[2]==='approve'&&method==='POST'){
 if(user.app_metadata.role!=='admin'&&!quoteStoreIds(user,true).includes(board.store_id))throw new PortalError(403,'Tu usuario puede consultar, pero no autorizar cotizaciones.');
 const b=await bodyJSON(r);if(!board.published||b.revision!==board.revision)throw new PortalError(409,'La versión del comparativo cambió. Actualiza antes de autorizar.');
 const data=checkedQuote(board.data),offer=data.offers.find(v=>v.id===b.offer_id);if(!offer)throw new PortalError(404,'Proveedor no disponible.');const totals=qTotals(data,offer);
 if(totals.errors.length)throw new PortalError(400,totals.errors.join('. '));if(b.confirm!==true||totals.missing.length&&b.confirm_partial!==true)throw new PortalError(400,'Confirma la autorización y los conceptos que quedan fuera.');
 const approval=await supa('/rest/v1/rpc/rh_approve_quote',{method:'POST',body:JSON.stringify({p_board:board.id,p_revision:board.revision,p_offer:offer.id,p_user:user.id,p_name:safeUser(user).name,p_partial:totals.missing.length>0})});return json({ok:true,approval});
 }
 throw new PortalError(404,'Ruta no encontrada.');
 }
 if(p[0]==='dashboard-templates'){
 membership(user,true);
 if(route==='dashboard-templates'&&method==='GET'){
 const cursor=new URL(r.url).searchParams.get('before');
 if(cursor&&!uuid(cursor))throw new PortalError(400,'Página de machotes no válida.');
 const rows=await supa('/rest/v1/rh_dashboard_templates?select=id,name,item_count,created_at&order=id.desc&limit=100'+(cursor?'&id=lt.'+cursor:''));
 return json({templates:rows,next:rows.length===100?rows.at(-1).id:null});
 }
 if(route==='dashboard-templates'&&method==='POST'){
 const b=await bodyJSON(r);const store=await requireStore(b.store_id,user);
 const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>100)throw new PortalError(400,'Escribe un nombre de hasta 100 caracteres para el machote.');
 const rows=await supa('/rest/v1/rh_dashboards?store_id=eq.'+store.id+'&select=items,revision');const source=rows[0];
 if(!source)throw new PortalError(404,'Primero inicia el dashboard de esta tienda.');
 if(source.revision!==b.revision)throw new PortalError(409,'El dashboard cambió. Actualiza antes de guardar el machote.');
 const items=cleanDashboardTemplate(source.items);
 const saved=await supa('/rest/v1/rh_dashboard_templates?select=id,name,item_count,created_at',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,items,item_count:items.length,created_by:user.id})});
 return json({template:saved[0]},201);
 }
 if(p.length===3&&p[2]==='apply'&&method==='POST'){
 if(!uuid(p[1]))throw new PortalError(404,'Machote no disponible.');
 const b=await bodyJSON(r);const store=await requireStore(b.store_id,user);
 if(b.revision!==null&&b.confirm_replace!==true)throw new PortalError(400,'Confirma que deseas reemplazar el dashboard de destino.');
 const rows=await supa('/rest/v1/rh_dashboard_templates?id=eq.'+p[1]+'&select=items');if(!rows[0])throw new PortalError(404,'Machote no disponible.');
 const items=cleanDashboardTemplate(rows[0].items);
 const dashboard=await writeDashboard(store.id,user.id,b.revision,items);
 return json({dashboard});
 }
 throw new PortalError(404,'Ruta no encontrada.');
 }
 if(p[0]==='stores'&&p.length===3&&p[2]==='dashboard'&&['GET','POST','PATCH'].includes(method)){
 // Validate role before processing mutations and always re-check the store grant.
 if(method!=='GET')membership(user,true);
 const store=await requireStore(p[1],user);
 const path='/rest/v1/rh_dashboards';const fields='store_id,revision,items,updated_at';
 if(method==='GET'){const rows=await supa(path+'?store_id=eq.'+store.id+'&select='+fields);return json({dashboard:rows[0]||null});}
 const b=await bodyJSON(r,262144);const items=validateDashboard(b.items);
 if(method==='POST'&&b.revision!==null||method==='PATCH'&&b.revision===null)throw new PortalError(400,'Versión del dashboard no válida.');
 const dashboard=await writeDashboard(store.id,user.id,b.revision,items);
 return json({dashboard},method==='POST'?201:200);
 }
 if(route==='documents'&&method==='GET'){
 const id=new URL(r.url).searchParams.get('store');if(!id)return json({documents:[]});await requireStore(id,user);
 const fields='id,title,filename,category,size,modified_at,published,store_id';
 const rows=await supa('/rest/v1/rh_documents?select='+fields+'&store_id=eq.'+id+'&category=in.(Planogramas,Listados)'+(user.app_metadata.role==='admin'?'':'&published=eq.true')+'&order=modified_at.desc&limit=5000');
 return json({documents:rows.filter((d:any)=>sectionName(d.category)===fileSection(String(d.filename))&&fileSection(String(d.filename))!==null)});}
 if(p[0]==='documents'&&p[1]&&p[2]==='link'&&method==='POST'){
 await documentRecord(p[1],user);const token=crypto.randomUUID()+crypto.randomUUID();
 const expires=Date.now()+15*60*1000;await transient('file:'+await digest(token),{uid:user.id,doc:p[1],expires});
 const url=endpoint(r)+'/documents/'+p[1]+'/file?ticket='+encodeURIComponent(token);return json({url,download:url+'&download=1',expires});}
 if(p[0]==='documents'&&p.length===2&&method==='DELETE'){
 await requireUser(r,true);if(!uuid(p[1]))throw new PortalError(404,'Documento no encontrado.');const b=await bodyJSON(r);
 const rows=await supa('/rest/v1/rh_documents?id=eq.'+p[1]+'&select=id,dropbox_id,filename,store_id,category');const d=rows[0];if(!d)return json({ok:true});
 const store=await requireStore(d.store_id,user);
 if(b.confirm_filename!==d.filename)throw new PortalError(409,'El archivo cambió. Actualiza la biblioteca y confirma de nuevo.');
 if(!sectionName(d.category)||fileSection(d.filename)!==sectionName(d.category))throw new PortalError(400,'Solo se pueden eliminar PDF de planogramas y Excel de listados.');
 let file:any;try{file=await dbx('files/get_metadata',{path:d.dropbox_id});}catch(error){if(!(error instanceof DropboxNotFound))throw error;}
 if(file){
 const folder=await liveFolder(store);const section=sectionForPath(String(file.path_lower||''),folder.path_lower,String(file.name));
 if(file['.tag']!=='file'||section!==sectionName(d.category))throw new PortalError(404,'El archivo cambió de ubicación. Sincroniza Dropbox antes de eliminarlo.');
 if(file.name!==b.confirm_filename)throw new PortalError(409,'El nombre del archivo cambió. Sincroniza y confirma de nuevo.');
 if(typeof file.rev!=='string'||!/^[a-f0-9]{9,}$/i.test(file.rev))throw new PortalError(502,'No se pudo verificar la versión del archivo. Intenta nuevamente.');
 // Pin the file ID and revision. Dropbox parent_rev does not permit folder deletion.
 try{await dbx('files/delete_v2',{path:d.dropbox_id,parent_rev:file.rev});}catch(error){if(!(error instanceof DropboxNotFound))throw error;}
 }
 // Retry-safe cleanup if Dropbox deletion succeeded but the prior database call failed.
 await supa('/rest/v1/rh_documents?id=eq.'+p[1],{method:'DELETE'});return json({ok:true});}
 if(p[0]==='documents'&&p[1]&&method==='PATCH'){
 await requireUser(r,true);if(!/^[a-f0-9-]{36}$/.test(p[1]))throw new PortalError(404,'Documento no encontrado.');const b:any=await bodyJSON(r);
 if(typeof b.published!=='boolean')throw new PortalError(400,'Estado no válido.');
 await supa('/rest/v1/rh_documents?id=eq.'+p[1],{method:'PATCH',body:JSON.stringify({published:b.published})});return json({ok:true});}
 if(route==='sync'&&method==='POST'){const b:any=await bodyJSON(r);return json(await syncBatch(typeof b.cursor==='string'?b.cursor:undefined));}
 if(route==='connections'&&method==='GET'){
 let database=false,connected=false;try{await supa('/rest/v1/rh_documents?select=id&limit=1');database=true;connected=!!(config().refresh||await setting('dropbox_refresh'));}catch{}
 return json({auth:true,database,dropboxApp:!!(config().dbxKey&&config().dbxSecret),dropbox:connected,root:config().root,secret:!!config().secret});}
 if(route==='dropbox/connect'&&method==='POST'){
 const c=config();if(!c.dbxKey||!c.dbxSecret||!c.secret)throw new PortalError(503,'Configura primero los secretos de Dropbox.');
 const nonce=crypto.randomUUID(),expires=Date.now()+600000;
 await transient('oauth:'+nonce,{uid:user.id,expires});const state=await seal('oauth',{nonce,uid:user.id,expires});
 const url='https://www.dropbox.com/oauth2/authorize?'+new URLSearchParams({client_id:c.dbxKey,response_type:'code',token_access_type:'offline',redirect_uri:endpoint(r)+'/dropbox/callback',state});
 return json({url});}
 if(route==='users'&&method==='GET'){
 let all:any[]=[];for(let page=1;page<=20;page++){const d=await supa('/auth/v1/admin/users?page='+page+'&per_page=100');all.push(...d.users);if(d.users.length<100)break;}
 return json({users:all.filter(u=>u.app_metadata?.rh_portal).map(safeUser)});}
 if(route==='users'&&method==='POST'){
 const b:any=await bodyJSON(r);const assignedStores=await validateStoreIds(b.store_ids??[]);const quotePermissions=await validateQuotePermissions(b);if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)throw new PortalError(400,'La contraseña debe tener entre 12 y 256 caracteres.');
 const u=await supa('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:email(b.username),password:b.password,email_confirm:true,user_metadata:{name:String(b.name||b.username).slice(0,100)},app_metadata:{rh_portal:true,role:b.role==='admin'?'admin':'reader',disabled:false,...quotePermissions,store_ids:assignedStores}})});
 return json({user:safeUser(u)},201);}
 if(p[0]==='users'&&p.length===2&&(method==='PATCH'||method==='DELETE')){
 if(!/^[a-f0-9-]{36}$/.test(p[1]))throw new PortalError(404,'Usuario no encontrado.');
 const target=await supa('/auth/v1/admin/users/'+p[1]);if(!target.app_metadata?.rh_portal)throw new PortalError(404,'Usuario no encontrado.');
 const b:any=await bodyJSON(r);
 if(method==='DELETE'){
 if(user.id===p[1])throw new PortalError(400,'No puedes eliminar tu propio acceso.');
 if(b.confirm_username!==target.email?.split('@')[0])throw new PortalError(400,'Escribe el usuario exacto para confirmar la eliminación.');
 await supa('/auth/v1/admin/users/'+p[1],{method:'DELETE',body:JSON.stringify({should_soft_delete:false})});return json({ok:true});}
 if(user.id===p[1]&&(b.enabled===false||(b.role!==undefined&&b.role!=='admin')))throw new PortalError(400,'No puedes desactivar tu acceso ni quitarte el permiso de administrador.');
 const changes:any={};
 if(b.username!==undefined){const nextEmail=email(b.username);if(nextEmail!==target.email){changes.email=nextEmail;changes.email_confirm=true;}}
 if(b.name!==undefined){if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100)throw new PortalError(400,'Escribe un nombre de hasta 100 caracteres.');changes.user_metadata={...target.user_metadata,name:b.name.trim()};}
 if(b.role!==undefined&&b.role!=='admin'&&b.role!=='reader')throw new PortalError(400,'Permisos no válidos.');
 if(b.store_ids!==undefined)changes.app_metadata={...target.app_metadata,store_ids:await validateStoreIds(b.store_ids)};
 if(b.quote_view_store_ids!==undefined||b.quote_approve_store_ids!==undefined||b.quote_approval!==undefined){changes.app_metadata={...(changes.app_metadata||target.app_metadata),...await validateQuotePermissions(b,target.app_metadata)};}
 if(typeof b.enabled==='boolean'||b.role!==undefined)changes.app_metadata={...(changes.app_metadata||target.app_metadata),...(typeof b.enabled==='boolean'?{disabled:!b.enabled}:{}),...(b.role!==undefined?{role:b.role}:{})};
 if(b.password!==undefined){if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)throw new PortalError(400,'Usa una contraseña de entre 12 y 256 caracteres.');changes.password=b.password;}
 if(!Object.keys(changes).length)throw new PortalError(400,'No hay cambios para guardar.');
 const u=await supa('/auth/v1/admin/users/'+p[1],{method:'PUT',body:JSON.stringify(changes)});return json({user:safeUser(u)});}
 if(p[0]==='upload'&&method==='POST'){
 if(route==='upload/start'){
 const b:any=await bodyJSON(r);const name=String(b.filename||'').normalize('NFC');const category=sectionName(b.category);const type=fileSection(name);
 if(!type||/[\/\\\u0000-\u001f]/.test(name)||name.length>180||name==='..'||!name)throw new PortalError(400,'Selecciona un PDF, XLSX o XLS con un nombre válido.');
 if(!category||category!==type)throw new PortalError(400,'Planogramas admite solo PDF; Listados admite solo Excel (XLSX o XLS).');
 const root=config().root;if(!root.startsWith('/')||root==='/')throw new PortalError(503,'Selecciona una carpeta dedicada para el portal.');
 const store=await requireStore(b.store_id,user);const storeFolder=await liveFolder(store);const folder=storeFolder.path_display+'/'+category.toLowerCase();
 try{await dbx('files/create_folder_v2',{path:folder,autorename:false});}catch(e){if(e instanceof PortalError&&e.message.includes('ocupado'))throw e;await dbx('files/get_metadata',{path:folder});}
 const response=await content('files/upload_session/start',{close:false},new Uint8Array());const d=await response.json() as any;
 const ticket=await seal('upload',{sid:d.session_id,path:folder+'/'+name,section:category,uid:user.id,store_id:store.id,expires:Date.now()+3600000});return json({ticket});}
 if(route==='upload/chunk'||route==='upload/finish'){
 const ticket=r.headers.get('X-Upload-Ticket');if(!ticket)throw new PortalError(400,'Falta la sesión de subida.');
 const t=await unseal('upload',ticket);const uploadStore=await requireStore(t.store_id,user);const uploadFolder=await liveFolder(uploadStore);if(!sectionForPath(String(t.path),uploadFolder.path_lower,String(t.path).split('/').at(-1)||''))throw new PortalError(403,'La tienda cambió. Inicia otra vez la subida.');if(t.uid!==user.id||t.expires<Date.now())throw new PortalError(403,'La sesión de subida venció.');
 const offset=Number(r.headers.get('X-Upload-Offset'));if(!Number.isSafeInteger(offset)||offset<0)throw new PortalError(400,'Posición de subida no válida.');
 const length=Number(r.headers.get('content-length'));if(length>8*1024*1024)throw new PortalError(413,'El bloque es demasiado grande.');
 const bytes=await bounded(r,8*1024*1024);const data=bytes.buffer;if(data.byteLength>8*1024*1024)throw new PortalError(413,'El bloque es demasiado grande.');
 if(offset===0&&data.byteLength){
 const name=String(t.path).split('/').at(-1)||'';const head=new Uint8Array(data);const pdf=/\.pdf$/i.test(name)&&new TextDecoder().decode(data.slice(0,5))==='%PDF-';
 const xlsx=/\.xlsx$/i.test(name)&&[0x50,0x4b,0x03,0x04].every((v,i)=>head[i]===v);
 const xls=/\.xls$/i.test(name)&&[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i)=>head[i]===v);
 if(!pdf&&!xlsx&&!xls)throw new PortalError(400,'El contenido del archivo no corresponde al formato PDF o Excel seleccionado.');}

 if(route==='upload/finish'&&offset===0&&data.byteLength===0)throw new PortalError(400,'El archivo está vacío.');
 if(route==='upload/chunk'){await content('files/upload_session/append_v2',{cursor:{session_id:t.sid,offset},close:false},data);return json({ok:true});}
 const upstream=await content('files/upload_session/finish',{cursor:{session_id:t.sid,offset},commit:{path:t.path,mode:'add',autorename:true,mute:false,strict_conflict:false}},data);
 const rec=await record(await upstream.json());if(rec)await supa('/rest/v1/rh_documents?on_conflict=dropbox_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rec)});
 return json({ok:true});}}
 throw new PortalError(404,'Ruta no encontrada.');
 }catch(e){if(e instanceof PortalError)return json({error:e.message},e.status);return json({error:'No se pudo completar la solicitud. Intenta nuevamente.'},500);}
}
Deno.serve(handle);
