// Retail Hub · Supabase Edge Function: retailhub-api
// No credentials belong in this file. Deploy with gateway Verify JWT OFF;
// protected routes verify the caller with Supabase Auth below.
const FRONTEND = 'https://grupobure.github.io/RetailHub/BibliotecaPlanog/';
const ORIGIN = new URL(FRONTEND).origin;
const env = new Proxy({}, {get:(_target,key)=>Deno.env.get(String(key))});
function injected(name:string, legacy:string) {
 const old=Deno.env.get(legacy); if(old)return old;
 try {return JSON.parse(Deno.env.get(name)||'{}').default;} catch {return undefined;}
}
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS',
 'Access-Control-Allow-Headers':'authorization,content-type,x-upload-ticket,x-upload-offset,range',
 'Access-Control-Expose-Headers':'content-range,content-length,content-disposition','Vary':'Origin'};


export class PortalError extends Error { constructor(public status:number, message:string){super(message);} }
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
async function bodyJSON(r:Request){try{return JSON.parse(new TextDecoder().decode(await bounded(r,16384)));}catch(e){if(e instanceof PortalError)throw e;throw new PortalError(400,'Solicitud no válida.');}}
export async function supa(path:string,init:RequestInit={},bearer?:string):Promise<any>{
 const c=config();if(!authReady())throw new PortalError(503,'La conexión de usuarios está pendiente de activación.');
 const h=new Headers(init.headers);h.set('apikey',c.anon!);const auth=bearer||c.service!;if(!auth.startsWith('sb_'))h.set('Authorization','Bearer '+auth);h.set('Content-Type','application/json');
 if(!bearer)h.set('apikey',c.service!);
 const r=await fetch(c.url+path,{...init,headers:h,signal:AbortSignal.timeout(30000)});
 if(!r.ok){const e=await r.json().catch(()=>({})) as any;
 if(r.status===429)throw new PortalError(429,'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
 if(r.status===401||r.status===403)throw new PortalError(401,'La sesión no es válida. Vuelve a iniciar sesión.');
 if(e.code==='42P01'||e.code==='PGRST205')throw new PortalError(503,'Falta preparar la base de datos. Revisa Conexiones.');
 throw new PortalError(400,'No se pudo completar la operación en la cuenta de usuarios.');}
 const text=await r.text();return text?JSON.parse(text):null;
}
export async function requireUser(r:Request,admin=false){
 const t=bearer(r);if(!t)throw new PortalError(401,'Inicia sesión para continuar.');
 return membership(await supa('/auth/v1/user',{},t),admin);
}
export const safeUser=(u:any)=>({id:u.id,name:u.user_metadata?.name||u.email?.split('@')[0],username:u.email?.split('@')[0],role:u.app_metadata?.role==='admin'?'admin':'reader',enabled:!u.app_metadata?.disabled,last_sign_in_at:u.last_sign_in_at});
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
 if(!r.ok){if(r.status===429)throw new PortalError(429,'Dropbox está ocupado. Intenta de nuevo en unos minutos.');throw new PortalError(400,d.error_summary?.includes('not_found')?'No se encontró la carpeta o el documento en Dropbox.':'Dropbox no pudo completar la operación.');}return d;
}
export async function content(path:string,args:any,body:BodyInit|null=null,range?:string){
 const h:Record<string,string>={Authorization:'Bearer '+await dbxToken(),'Dropbox-API-Arg':headerJSON(args),'Content-Type':'application/octet-stream'};
 if(range)h.Range=range;
 const r=await fetch('https://content.dropboxapi.com/2/'+path,{method:'POST',headers:h,body});
 if(!r.ok&&r.status!==416)throw new PortalError(r.status===429?429:502,'No se pudo transferir el archivo con Dropbox. Intenta nuevamente.');return r;
}
export function record(e:any){
 const root=config().root.toLowerCase()+'/';const path=String(e.path_lower||'');
 if(!path.startsWith(root)||!String(e.name).toLowerCase().endsWith('.pdf'))return null;
 const parts=(e.path_display||e.path_lower).slice(config().root.length+1).split('/');
 return {dropbox_id:e.id,title:e.name.replace(/\.pdf$/i,'').replace(/_/g,' '),filename:e.name,category:parts.length>1?parts[0]:'General',size:e.size,revision:e.rev,modified_at:e.server_modified,updated_at:new Date().toISOString()};
}
export async function syncBatch(cursor?:string){
 const c=config();if(!c.root.startsWith('/')||c.root==='/')throw new PortalError(503,'Selecciona una carpeta dedicada para el portal.');
 const d=await dbx(cursor?'files/list_folder/continue':'files/list_folder',cursor?{cursor}:{path:c.root,recursive:true,include_deleted:false,limit:200});
 const rows=d.entries.filter((e:any)=>e['.tag']==='file').map(record).filter(Boolean);
 if(rows.length)await supa('/rest/v1/rh_documents?on_conflict=dropbox_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});
 return {count:rows.length,cursor:d.has_more?d.cursor:null};
}

async function seal(type:string,value:Record<string,unknown>){return encrypted(JSON.stringify({...value,type}));}
async function unseal(type:string,value:string){try{const data=JSON.parse(await encrypted(value,true));if(data.type!==type||!Number.isFinite(data.expires)||data.expires<Date.now())throw Error();return data;}catch{throw new PortalError(403,'La autorización venció. Vuelve a intentarlo.');}}
async function digest(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');}
const endpoint=(r:Request)=>config().url+'/functions/v1/retailhub-api';
async function documentRecord(id:string,user:any){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new PortalError(404,'Documento no encontrado.');
 const rows=await supa('/rest/v1/rh_documents?id=eq.'+id+'&select=dropbox_id,filename,published');const d=rows[0];
 if(!d||(!d.published&&user.app_metadata.role!=='admin'))throw new PortalError(404,'Documento no disponible.');return d;
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

export async function handle(r:Request){
 try{
 const segments=new URL(r.url).pathname.split('/').filter(Boolean);const index=segments.indexOf('retailhub-api');const p=index>=0?segments.slice(index+1):segments;const route=p.join('/'); const method=r.method;
 if(method==='OPTIONS'){sameOrigin(r);return new Response(null,{status:204,headers:cors});}
 if(method!=='GET')sameOrigin(r);
 if(route==='status'&&method==='GET')return json({auth:authReady(),dropboxApp:!!(config().dbxKey&&config().dbxSecret),root:authReady()?undefined:null});
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
 const headers=new Headers({...cors,'Content-Type':'application/pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes','Content-Disposition':`${new URL(r.url).searchParams.has('download')?'attachment':'inline'}; filename="documento.pdf"; filename*=UTF-8''${encodeURIComponent(d.filename).replace(/'/g,'%27')}`});
 for(const k of ['content-length','content-range'])if(upstream.headers.has(k))headers.set(k,upstream.headers.get(k)!);
 return new Response(upstream.body,{status:upstream.status,headers});}
 const admin=['users','sync','connections','upload','dropbox'].includes(p[0]); const user=await requireUser(r,admin);
 if(route==='me'&&method==='GET')return json({user:safeUser(user)});
 if(route==='documents'&&method==='GET'){
 const fields='id,title,filename,category,size,modified_at,published';
 return json({documents:await supa('/rest/v1/rh_documents?select='+fields+(user.app_metadata.role==='admin'?'':'&published=eq.true')+'&order=modified_at.desc&limit=5000')});}
 if(p[0]==='documents'&&p[1]&&p[2]==='link'&&method==='POST'){
 await documentRecord(p[1],user);const token=crypto.randomUUID()+crypto.randomUUID();
 const expires=Date.now()+15*60*1000;await transient('file:'+await digest(token),{uid:user.id,doc:p[1],expires});
 const url=endpoint(r)+'/documents/'+p[1]+'/file?ticket='+encodeURIComponent(token);return json({url,download:url+'&download=1',expires});}
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
 const b:any=await bodyJSON(r);if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)throw new PortalError(400,'La contraseña debe tener entre 12 y 256 caracteres.');
 const u=await supa('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:email(b.username),password:b.password,email_confirm:true,user_metadata:{name:String(b.name||b.username).slice(0,100)},app_metadata:{rh_portal:true,role:b.role==='admin'?'admin':'reader',disabled:false}})});
 return json({user:safeUser(u)},201);}
 if(p[0]==='users'&&p[1]&&method==='PATCH'){
 if(!/^[a-f0-9-]{36}$/.test(p[1]))throw new PortalError(404,'Usuario no encontrado.');
 const b:any=await bodyJSON(r);const target=await supa('/auth/v1/admin/users/'+p[1]);if(!target.app_metadata?.rh_portal)throw new PortalError(404,'Usuario no encontrado.');
 if(user.id===p[1]&&b.enabled===false)throw new PortalError(400,'No puedes desactivar tu propio acceso.');
 const changes:any={};if(typeof b.enabled==='boolean')changes.app_metadata={...target.app_metadata,disabled:!b.enabled};
 if(b.password!==undefined){if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)throw new PortalError(400,'Usa una contraseña de al menos 12 caracteres.');changes.password=b.password;}
 if(!Object.keys(changes).length)throw new PortalError(400,'No hay cambios para guardar.');
 const u=await supa('/auth/v1/admin/users/'+p[1],{method:'PUT',body:JSON.stringify(changes)});return json({user:safeUser(u)});}
 if(p[0]==='upload'&&method==='POST'){
 if(route==='upload/start'){
 const b:any=await bodyJSON(r);const name=String(b.filename||'').normalize('NFC');const category=String(b.category||'General').normalize('NFC');
 if(!name.toLowerCase().endsWith('.pdf')||/[\/\\\u0000-\u001f]/.test(name)||name.length>180||name==='..'||!name)throw new PortalError(400,'Selecciona un archivo PDF con un nombre válido.');
 if(!/^[\p{L}\p{N} _-]{1,60}$/u.test(category))throw new PortalError(400,'Revisa el nombre de la categoría.');
 const root=config().root;if(!root.startsWith('/')||root==='/')throw new PortalError(503,'Selecciona una carpeta dedicada para el portal.');
 const folder=root+'/'+category;
 try{await dbx('files/create_folder_v2',{path:folder,autorename:false});}catch(e){if(e instanceof PortalError&&e.message.includes('ocupado'))throw e;await dbx('files/get_metadata',{path:folder});}
 const response=await content('files/upload_session/start',{close:false},new Uint8Array());const d=await response.json() as any;
 const ticket=await seal('upload',{sid:d.session_id,path:folder+'/'+name,uid:user.id,expires:Date.now()+3600000});return json({ticket});}
 if(route==='upload/chunk'||route==='upload/finish'){
 const ticket=r.headers.get('X-Upload-Ticket');if(!ticket)throw new PortalError(400,'Falta la sesión de subida.');
 const t=await unseal('upload',ticket);if(t.uid!==user.id||t.expires<Date.now())throw new PortalError(403,'La sesión de subida venció.');
 const offset=Number(r.headers.get('X-Upload-Offset'));if(!Number.isSafeInteger(offset)||offset<0)throw new PortalError(400,'Posición de subida no válida.');
 const length=Number(r.headers.get('content-length'));if(length>8*1024*1024)throw new PortalError(413,'El bloque es demasiado grande.');
 const bytes=await bounded(r,8*1024*1024);const data=bytes.buffer;if(data.byteLength>8*1024*1024)throw new PortalError(413,'El bloque es demasiado grande.');
 if(offset===0&&data.byteLength&&new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw new PortalError(400,'El archivo no tiene un encabezado PDF válido.');
 if(route==='upload/finish'&&offset===0&&data.byteLength===0)throw new PortalError(400,'El PDF está vacío.');
 if(route==='upload/chunk'){await content('files/upload_session/append_v2',{cursor:{session_id:t.sid,offset},close:false},data);return json({ok:true});}
 const upstream=await content('files/upload_session/finish',{cursor:{session_id:t.sid,offset},commit:{path:t.path,mode:'add',autorename:true,mute:false,strict_conflict:false}},data);
 const rec=record(await upstream.json());if(rec)await supa('/rest/v1/rh_documents?on_conflict=dropbox_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rec)});
 return json({ok:true});}}
 throw new PortalError(404,'Ruta no encontrada.');
 }catch(e){if(e instanceof PortalError)return json({error:e.message},e.status);return json({error:'No se pudo completar la solicitud. Intenta nuevamente.'},500);}
}
Deno.serve(handle);
