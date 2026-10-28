// Supabase Edge Function: retailhub-mail. Gateway Verify JWT OFF; every route
// verifies the portal's JWT and fresh trusted app_metadata below.
// No passwords, service keys or customer messages belong in this source file.
import {ImapFlow} from 'npm:imapflow@2.9.1';
import nodemailer from 'npm:nodemailer@10.2.1';
import PostalMime from 'npm:postal-mime@4.1.4';
import {Buffer} from 'node:buffer';

const BUILD='retailhub-mail-1';
const HOST='mail.privateemail.com';
const ORIGINS=new Set(['https://retailhub.mx','https://www.retailhub.mx','https://grupobure.github.io']);
const MAX_RAW=12*1024*1024,MAX_ATTACHMENTS=8*1024*1024;
const LOGO='https://retailhub.mx/BibliotecaPlanog/assets/retail-hub.png';
const env=(name:string)=>Deno.env.get(name)||'';
const keyEnv=(legacy:string,injected:string)=>{if(env(legacy))return env(legacy);try{return JSON.parse(env(injected)||'{}').default||'';}catch{return '';}};
const service=()=>keyEnv('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
const anon=()=>keyEnv('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');
const secret=()=>env('RH_MAIL_ENCRYPTION_SECRET')||env('RH_ENCRYPTION_SECRET');
export class MailError extends Error{constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new MailError(status,message);};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const str=(v:unknown,max:number,label:string):string=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))return fail(400,'Revisa '+label+'.');return v;};
const publicAccount=(a:any)=>({id:a.id,email:a.email,owner_id:a.owner_id,enabled:a.enabled,revision:a.revision,signature:a.signature||{},updated_at:a.updated_at});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(r:Request){
 const reader=r.body?.getReader();if(!reader)return {};
 const parts:Uint8Array[]=[];let size=0;
 while(true){const d=await reader.read();if(d.done)break;size+=d.value.length;if(size>13*1024*1024){await reader.cancel();fail(413,'El mensaje supera el tamaño permitido.');}parts.push(d.value);}
 try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))return fail(400,'Solicitud no válida.');return value;}catch{return fail(400,'Solicitud no válida.');}
}
export async function db(path:string,init:RequestInit={},token?:string){
 if(!service()||!anon()||!env('SUPABASE_URL'))fail(503,'Falta activar la función de correo.');
 const key=token?anon():service();const headers=new Headers(init.headers);headers.set('apikey',key);headers.set('Content-Type','application/json');
 if(token||!key.startsWith('sb_'))headers.set('Authorization','Bearer '+(token||key));
 const r=await fetch(env('SUPABASE_URL').replace(/\/$/,'')+path,{...init,headers,signal:AbortSignal.timeout(15000)});
 if(!r.ok){const error=await r.json().catch(()=>({}));const message=String(error.message||'');
  if(r.status===401||r.status===403)fail(401,'Vuelve a iniciar sesión en Retail Hub.');
  if(error.code==='42P01'||error.code==='PGRST205'||error.code==='PGRST202')fail(503,'Falta aplicar la actualización 009 de correo.');
  if(error.code==='23505'||message.includes('mail_conflict'))fail(409,'La cuenta cambió o el intento ya fue utilizado. Actualiza antes de continuar.');
  if(message.includes('mail_rate'))fail(429,'Alcanzaste el límite temporal de envíos. Espera antes de enviar otro correo.');
  if(message.includes('mail_access'))fail(403,'No tienes acceso a este buzón.');
  if(message.includes('mail_confirm'))fail(400,'Confirma la reasignación del buzón.');
  if(message.includes('mail_owner'))fail(400,'Selecciona un usuario activo del portal.');
  fail(502,'No se pudo guardar la operación de correo.');
 }
 const text=await r.text();return text?JSON.parse(text):null;
}
const member=(u:any)=>{if(!u?.app_metadata?.rh_portal||u.app_metadata.disabled)fail(403,'Este usuario no tiene acceso al portal.');return u;};
const admin=(u:any)=>{member(u);if(u.app_metadata.role!=='admin')fail(403,'Esta acción es solo para administradores.');};
async function caller(r:Request){const token=r.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)fail(401,'Inicia sesión para continuar.');return member(await db('/auth/v1/user',{},token));}
export async function crypt(value:string,email:string,decrypt=false){
 if(secret().length<32)fail(503,'Falta configurar RH_MAIL_ENCRYPTION_SECRET en los secretos de Supabase (mínimo 32 caracteres).');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('retailhub-mail-v1|'+secret())),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const aad=new TextEncoder().encode(email);
 if(decrypt){try{const [version,iv,cipher]=value.split('.');if(version!=='v1')throw Error();return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64'),additionalData:aad},key,Buffer.from(cipher,'base64')));}catch{fail(503,'Vuelve a conectar la contraseña de aplicación de este buzón.');}}
 const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(value));
 return 'v1.'+Buffer.from(iv).toString('base64')+'.'+Buffer.from(cipher).toString('base64');
}
export const adapters={
 imap:(auth:any)=>new ImapFlow({host:HOST,port:993,secure:true,auth,logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:12000,greetingTimeout:12000,socketTimeout:25000,tls:{rejectUnauthorized:true}}),
 smtp:(auth:any)=>nodemailer.createTransport({host:HOST,port:465,secure:true,auth,connectionTimeout:12000,greetingTimeout:12000,socketTimeout:30000,logger:false,debug:false,tls:{rejectUnauthorized:true},disableFileAccess:true,disableUrlAccess:true}),
 mime:()=>nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows',disableFileAccess:true,disableUrlAccess:true}),
 parse:(source:Uint8Array)=>PostalMime.parse(source,{attachmentEncoding:'base64'})
};
function mailFailure(e:any):never{
 if(e instanceof MailError)throw e;
 if(e.authenticationFailed||e.code==='EAUTH')fail(502,'Namecheap rechazó la conexión. Revisa la contraseña de aplicación del buzón.');
 return fail(502,'No se pudo conectar con Namecheap. Revisa la conexión del buzón o intenta de nuevo.');
}
async function verify(email:string,password:string){const auth={user:email,pass:password};const client=adapters.imap(auth);client.on('error',()=>{});const smtp=adapters.smtp(auth);
 try{await client.connect();await smtp.verify();}catch(e){mailFailure(e);}finally{client.close();smtp.close();}}
async function accountFor(user:any){const rows=await db('/rest/v1/rh_mail_accounts?owner_id=eq.'+user.id+'&enabled=eq.true&select=*');if(!rows[0])fail(403,'No tienes un buzón habilitado.');return rows[0];}
async function freshAccount(a:any,user:any){member(await db('/auth/v1/admin/users/'+user.id));const rows=await db('/rest/v1/rh_mail_accounts?id=eq.'+a.id+'&owner_id=eq.'+user.id+'&enabled=eq.true&revision=eq.'+a.revision+'&select=id');if(!rows.length)fail(403,'El acceso al buzón cambió. Actualiza el portal.');}
async function withMailbox(user:any,fn:(client:any,a:any,password:string)=>Promise<any>){
 const a=await accountFor(user);const password=await crypt(a.encrypted_password,a.email,true);const client=adapters.imap({user:a.email,pass:password});client.on('error',()=>{});
 try{await client.connect();await freshAccount(a,user);const result=await fn(client,a,password);await freshAccount(a,user);return result;}catch(e){mailFailure(e);}finally{client.close();}
}
const folder=(v:unknown)=>{const value=str(v,240,'la carpeta');if(!value||/[\r\n]/.test(value))fail(400,'Carpeta no válida.');return value;};
async function selected(client:any,input:any){const path=folder(input.folder);const box=await client.mailboxOpen(path);if(!box)fail(404,'La carpeta ya no está disponible.');if(input.validity!==undefined&&String(box.uidValidity)!==String(input.validity))fail(409,'La carpeta cambió. Actualiza la lista de mensajes.');return box;}
function messageUid(input:any){if(!Number.isSafeInteger(input.uid)||input.uid<1||!/^\d+$/.test(String(input.validity||'')))fail(400,'Mensaje no válido.');return input.uid;}
async function rawMessage(client:any,input:any){const uid=messageUid(input);await selected(client,input);const meta=await client.fetchOne(uid,{size:true},{uid:true});if(!meta)fail(404,'El mensaje ya no está en esta carpeta.');if(meta.size>MAX_RAW)fail(413,'Este mensaje supera 12 MB. Puedes abrirlo completo desde Private Email.');const m=await client.fetchOne(uid,{source:true},{uid:true});if(!m?.source)fail(404,'Mensaje no disponible.');if(m.source.length>MAX_RAW)fail(413,'El mensaje supera 12 MB.');return adapters.parse(m.source);}
async function specialFolder(client:any,kind:'sent'|'drafts'|'trash'){
 const expected={sent:'\\Sent',drafts:'\\Drafts',trash:'\\Trash'}[kind];const folders=await client.list();const found=folders.find((f:any)=>f.specialUse===expected);if(found)return found.path;
 const fallback={sent:'Sent',drafts:'Drafts',trash:'Trash'}[kind];const existing=folders.find((f:any)=>f.path.toLowerCase()===fallback.toLowerCase());if(existing)return existing.path;
 await client.mailboxCreate(fallback);return fallback;
}
const escape=(v:unknown)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function validateSignature(input:any){if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Firma no válida.');const s:any={};for(const [k,max]of Object.entries({name:100,position:100,phone:60,website:200,note:300}))s[k]=str(input[k]??'',max,'la firma').trim();if(s.website&&!/^https:\/\/[^\s<>]+$/i.test(s.website))fail(400,'La página de la firma debe comenzar con https://.');s.logo=input.logo!==false;return s;}
export function signatureHTML(signature:any,email:string){const s=validateSignature(signature);return '<table role="presentation" style="margin-top:24px;border-top:1px solid #dce5eb;padding-top:16px;font:13px Arial,sans-serif;color:#173d60"><tr>'+(s.logo?'<td style="padding-right:18px;vertical-align:top"><img src="'+LOGO+'" alt="Retail Hub" width="110" style="display:block"></td>':'')+'<td>'+(s.name?'<strong style="font-size:15px">'+escape(s.name)+'</strong><br>':'')+(s.position?escape(s.position)+'<br>':'')+'<strong style="color:#008649">Retail Hub</strong><br><a href="mailto:'+escape(email)+'" style="color:#173d60">'+escape(email)+'</a>'+(s.phone?'<br>'+escape(s.phone):'')+(s.website?'<br><a href="'+escape(s.website)+'" style="color:#008649">'+escape(s.website)+'</a>':'')+(s.note?'<p style="font-size:11px;color:#607887">'+escape(s.note)+'</p>':'')+'</td></tr></table>';}
export function recipients(value:unknown){const text=str(value??'',2000,'los destinatarios');if(/[\r\n]/.test(text))fail(400,'Destinatario no válido.');const parts=text.split(/[;,]/).map(s=>s.trim()).filter(Boolean);if(parts.length>20||parts.some(p=>p.length>254||!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/.test(p)))fail(400,'Escribe direcciones de correo válidas, separadas por coma.');return [...new Set(parts)];}
export function validateCompose(input:any,requireRecipient=true){
 const to=recipients(input.to),cc=recipients(input.cc),bcc=recipients(input.bcc);if(requireRecipient&&!to.length)fail(400,'Agrega al menos un destinatario.');if(to.length+cc.length+bcc.length>20)fail(400,'Máximo 20 destinatarios por mensaje.');
 const subject=str(input.subject??'',200,'el asunto');if(/[\r\n]/.test(subject))fail(400,'Asunto no válido.');const text=str(input.text??'',120000,'el mensaje');const files=input.files??[];
 if(!Array.isArray(files)||files.length>8)fail(400,'Máximo 8 adjuntos.');let total=0;
 const attachments=files.map((f:any)=>{const filename=str(f.filename,180,'el nombre del adjunto');if(!filename||/[\r\n\/\\\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(filename))fail(400,'Nombre de adjunto no válido.');const content=str(f.content,12*1024*1024,'el adjunto');if(content.length%4!==0||/[^A-Za-z0-9+/=]/.test(content))fail(400,'Adjunto no válido.');const bytes=Buffer.from(content,'base64');if(bytes.toString('base64')!==content)fail(400,'Adjunto no válido.');total+=bytes.length;if(total>MAX_ATTACHMENTS)fail(413,'Los adjuntos juntos deben pesar como máximo 8 MB.');return {filename,content:bytes};});
 return {to,cc,bcc,subject,text,attachments};
}
function addresses(values:any){return Array.isArray(values)?values.filter(v=>v.address).map(v=>({name:String(v.name||''),address:String(v.address)})):[];}
const safeFilename=(value:any,index:number)=>String(value||'adjunto-'+(index+1)).replace(/[\/\\\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,180).trim()||'adjunto';
async function buildMessage(client:any,account:any,input:any,prepared:any,kind:'send'|'draft',id:string){
 const s=validateSignature(account.signature||{});let inReplyTo:string|undefined;
 if(input.reply){messageUid(input.reply);await selected(client,input.reply);const previous=await client.fetchOne(input.reply.uid,{envelope:true},{uid:true});if(!previous)fail(409,'El mensaje original ya no está disponible.');const messageId=previous.envelope?.messageId;if(typeof messageId==='string'&&messageId.length<500&&!/[\r\n]/.test(messageId))inReplyTo=messageId;}
 const signatureText=[s.name,s.position,'Retail Hub',account.email,s.phone,s.website,s.note].filter(Boolean).join('\n');
 const message=await adapters.mime().sendMail({from:{name:s.name||'Retail Hub',address:account.email},to:prepared.to,cc:prepared.cc,bcc:kind==='draft'?prepared.bcc:undefined,subject:prepared.subject,
  text:prepared.text+(kind==='send'?'\n\n'+signatureText:''),html:'<div style="font:14px/1.7 Arial,sans-serif;color:#17364e;white-space:pre-wrap">'+escape(prepared.text)+'</div>'+(kind==='send'?signatureHTML(s,account.email):''),
  attachments:prepared.attachments,messageId:id,inReplyTo,references:inReplyTo?[inReplyTo]:undefined,date:new Date(),disableFileAccess:true,disableUrlAccess:true});
 if(message.message.length>MAX_RAW)fail(413,'El correo completo supera 12 MB. Reduce los adjuntos.');return message.message;
}
async function send(user:any,input:any){
 if(!uuid(input.request_id))fail(400,'Identificador de envío no válido.');
 const prepared=validateCompose(input);const a=await accountFor(user);const id='<rh-'+input.request_id+'@retailhub.mx>';
 const fingerprint=JSON.stringify({to:prepared.to,cc:prepared.cc,bcc:prepared.bcc,subject:prepared.subject,text:prepared.text,files:input.files||[],reply:input.reply||null});
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint))).toString('hex');
 const claimed=await db('/rest/v1/rpc/rh_mail_claim_send',{method:'POST',body:JSON.stringify({p_user:user.id,p_account:a.id,p_revision:a.revision,p_id:input.request_id,p_hash:hash,p_message_id:id})});
 if(!claimed.created)return {status:claimed.status,message_id:claimed.message_id,copy_saved:claimed.copy_saved,duplicate:true};
 let phase='preparing',accepted=false;let client:any,smtp:any;
 const update=async(status:string,copy_saved=false)=>db('/rest/v1/rh_mail_sends?id=eq.'+input.request_id+'&account_id=eq.'+a.id+'&user_id=eq.'+user.id,{method:'PATCH',body:JSON.stringify({status,copy_saved,updated_at:new Date().toISOString()})});
 try{
  const password=await crypt(a.encrypted_password,a.email,true);client=adapters.imap({user:a.email,pass:password});client.on('error',()=>{});await client.connect();await freshAccount(a,user);
  // Resolve the Sent folder and build all content before attempting SMTP.
  const sent=await specialFolder(client,'sent');const raw=await buildMessage(client,a,input,prepared,'send',id);
  await freshAccount(a,user);await update('sending');phase='sending';
  smtp=adapters.smtp({user:a.email,pass:password});const result=await smtp.sendMail({envelope:{from:a.email,to:[...new Set([...prepared.to,...prepared.cc,...prepared.bcc])]},raw,disableFileAccess:true,disableUrlAccess:true});
  if(!result.accepted?.length)throw Object.assign(Error(),{code:'EENVELOPE',responseCode:550});accepted=true;
  let copy_saved=false;try{await client.append(sent,raw,['\\Seen']);copy_saved=true;}catch{}
  let status_saved=true;try{await update('sent',copy_saved);}catch{status_saved=false;}
  return {status:'sent',message_id:id,copy_saved,status_saved,rejected:result.rejected||[]};
 }catch(e:any){
  // Never convert an accepted SMTP delivery into an error that encourages retry.
  if(accepted)return {status:'sent',message_id:id,copy_saved:false,status_saved:false};
  const definite=phase==='preparing'||e.code==='EAUTH'||e.code==='EENVELOPE'||(Number.isInteger(e.responseCode)&&e.responseCode>=400);
  const status=definite?'failed':'unknown';await update(status).catch(()=>{});
  return {status,message_id:id,error:definite?'El correo no pudo enviarse. Revisa la conexión o los destinatarios.':'Namecheap no confirmó el resultado. Revisa Enviados y consulta al destinatario antes de intentar un envío nuevo.'};
 }finally{client?.close();smtp?.close();}
}
async function route(r:Request){
 const url=new URL(r.url),segments=url.pathname.split('/').filter(Boolean),at=segments.indexOf('retailhub-mail');const path=(at<0?segments:segments.slice(at+1)).join('/');
 if(r.method==='OPTIONS')return new Response(null,{status:204});
 const user=await caller(r);
 if(path==='me'&&r.method==='GET'){const rows=await db('/rest/v1/rh_mail_accounts?owner_id=eq.'+user.id+'&enabled=eq.true&select=*');return json({build:BUILD,cryptoReady:secret().length>=32,account:rows[0]?publicAccount(rows[0]):null});}
 if(path==='admin/accounts'&&r.method==='GET'){admin(user);const rows=await db('/rest/v1/rh_mail_accounts?select=id,email,owner_id,enabled,signature,revision,updated_at&order=email');return json({accounts:rows.map(publicAccount),cryptoReady:secret().length>=32});}
 if(path==='admin/accounts'&&r.method==='POST'){
  admin(user);const input=await body(r);const email=str(input.email,100,'el correo').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{0,63}@retailhub\.mx$/.test(email))fail(400,'Utiliza una cuenta @retailhub.mx creada en Namecheap.');
  const owner=input.owner_id||null;if(owner!==null&&!uuid(owner))fail(400,'Usuario no válido.');if(typeof input.enabled!=='boolean'||(input.enabled&&!owner))fail(400,'Selecciona un usuario para habilitar el buzón.');
  let previous:any;if(input.id){if(!uuid(input.id)||!Number.isInteger(input.revision))fail(400,'Cuenta no válida.');previous=(await db('/rest/v1/rh_mail_accounts?id=eq.'+input.id+'&select=*'))[0];if(!previous||previous.revision!==input.revision)fail(409,'La cuenta cambió. Actualiza antes de guardar.');if(previous.email!==email)fail(400,'No puedes cambiar la dirección de una cuenta vinculada.');if(previous.owner_id&&previous.owner_id!==owner&&!input.confirm_reassign)fail(400,'Confirma la reasignación del buzón.');}
  if(owner)member(await db('/auth/v1/admin/users/'+owner));
  let encrypted=previous?.encrypted_password;
  if(input.enabled||input.password||!previous){const password=input.password?str(input.password,256,'la contraseña de aplicación'):previous?await crypt(previous.encrypted_password,email,true):'';
   if(password.length<8)fail(400,'Agrega la contraseña de aplicación de Namecheap.');if(input.enabled)await verify(email,password);encrypted=await crypt(password,email);}
  // Revocation remains possible even if the stored application password needs reconnecting.
  const id=await db('/rest/v1/rpc/rh_mail_assign',{method:'POST',body:JSON.stringify({p_admin:user.id,p_id:previous?.id||null,p_email:email,p_owner:owner,p_enabled:input.enabled,p_password:encrypted,p_revision:previous?.revision||0,p_confirm:input.confirm_reassign===true})});
  return json({account:publicAccount((await db('/rest/v1/rh_mail_accounts?id=eq.'+id+'&select=*'))[0])});
 }
 if(path==='signature'&&r.method==='PATCH'){const a=await accountFor(user);const input=await body(r);if(input.revision!==a.revision)fail(409,'La firma cambió. Actualiza antes de guardar.');const signature=validateSignature(input.signature);const rows=await db('/rest/v1/rh_mail_accounts?id=eq.'+a.id+'&owner_id=eq.'+user.id+'&enabled=eq.true&revision=eq.'+a.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({signature,revision:a.revision+1,updated_at:new Date().toISOString()})});if(!rows.length)fail(409,'El acceso al buzón cambió.');return json({account:publicAccount(rows[0])});}
 if(path==='send'&&r.method==='POST')return json(await send(user,await body(r)));
 if(path==='send-status'&&r.method==='GET'){const a=await accountFor(user),id=url.searchParams.get('id');if(!uuid(id))fail(400,'Envío no válido.');const rows=await db('/rest/v1/rh_mail_sends?id=eq.'+id+'&account_id=eq.'+a.id+'&user_id=eq.'+user.id+'&select=status,message_id,copy_saved');return json({result:rows[0]||null});}
 if(path==='folders'&&r.method==='GET')return json(await withMailbox(user,async client=>({folders:(await client.list()).filter((f:any)=>!f.flags?.has('\\Noselect')).map((f:any)=>({path:f.path,name:f.name,special:f.specialUse||null}))})));
 if(path==='messages'&&r.method==='GET')return json(await withMailbox(user,async client=>{
  const page=Number(url.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>10000)fail(400,'Página no válida.');const box=await selected(client,{folder:url.searchParams.get('folder')||'INBOX'});const end=box.exists-page*30,start=Math.max(1,end-29);const items=[];
  if(end>=1)for await(const m of client.fetch(start+':'+end,{uid:true,envelope:true,flags:true,size:true,internalDate:true})){items.push({uid:m.uid,subject:m.envelope?.subject||'(Sin asunto)',from:addresses(m.envelope?.from),to:addresses(m.envelope?.to),date:m.internalDate||null,seen:!!m.flags?.has('\\Seen'),size:m.size});}
  return {items:items.sort((a,b)=>b.uid-a.uid),validity:String(box.uidValidity),total:box.exists,page,has_more:start>1&&end>=1};
 }));
 if(path==='message'&&r.method==='POST'){const input=await body(r);return json(await withMailbox(user,async client=>{const mail:any=await rawMessage(client,input);await client.messageFlagsAdd(input.uid,['\\Seen'],{uid:true});return {subject:mail.subject||'(Sin asunto)',from:addresses(mail.from?[mail.from]:[]),to:addresses(mail.to),cc:addresses(mail.cc),bcc:addresses(mail.bcc),reply_to:addresses(mail.replyTo),date:mail.date||null,text:String(mail.text||'').slice(0,600000),html:String(mail.html||'').slice(0,900000),attachments:(mail.attachments||[]).map((a:any,i:number)=>({index:i,filename:safeFilename(a.filename,i),size:Math.floor((a.content?.length||0)*3/4),mime:String(a.mimeType||'application/octet-stream')}))};}));}
 if(path==='attachment'&&r.method==='POST'){const input=await body(r);return json(await withMailbox(user,async client=>{const mail:any=await rawMessage(client,input);if(!Number.isInteger(input.index)||input.index<0||!mail.attachments?.[input.index])fail(404,'Adjunto no disponible.');const a=mail.attachments[input.index];return {filename:safeFilename(a.filename,input.index),content:a.content};}));}
 if(path==='read'&&r.method==='POST'){const input=await body(r);if(typeof input.seen!=='boolean')fail(400,'Estado no válido.');return json(await withMailbox(user,async client=>{messageUid(input);await selected(client,input);if(input.seen)await client.messageFlagsAdd(input.uid,['\\Seen'],{uid:true});else await client.messageFlagsRemove(input.uid,['\\Seen'],{uid:true});return {ok:true};}));}
 if(path==='move'&&r.method==='POST'){const input=await body(r);if(!['trash','inbox'].includes(input.target))fail(400,'Destino no válido.');return json(await withMailbox(user,async client=>{messageUid(input);await selected(client,input);const target=input.target==='inbox'?'INBOX':await specialFolder(client,'trash');if(target===input.folder)return {ok:true};await client.messageMove(input.uid,target,{uid:true});return {ok:true};}));}
 if(path==='draft'&&r.method==='POST'){const input=await body(r);const prepared=validateCompose(input,false);return json(await withMailbox(user,async(client,a)=>{const path=await specialFolder(client,'drafts');const raw=await buildMessage(client,a,input,prepared,'draft','<draft-'+crypto.randomUUID()+'@retailhub.mx>');const result=await client.append(path,raw,['\\Draft']);return {ok:true,folder:path,uid:result?.uid||null,validity:String(result?.uidValidity||'')};}));}
 fail(404,'Ruta de correo no encontrada.');
}
export async function handle(r:Request){const origin=r.headers.get('origin');let response:Response;
 try{if(origin&&!ORIGINS.has(origin))fail(403,'Origen no autorizado.');response=await route(r);}catch(e){response=e instanceof MailError?json({error:e.message},e.status):json({error:'No se pudo completar la operación de correo. Intenta de nuevo.'},502);}
 const h=new Headers(response.headers);h.set('Vary','Origin');if(origin&&ORIGINS.has(origin))h.set('Access-Control-Allow-Origin',origin);h.set('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');h.set('Access-Control-Allow-Headers','authorization,content-type');h.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,headers:h});
}
Deno.serve(handle);
