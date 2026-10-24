// Run from source project: node github-export/server/test-api.mjs
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../source/package.json',import.meta.url))('typescript');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const environment={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',DROPBOX_APP_KEY:'app-test',DROPBOX_APP_SECRET:'dropbox-secret',DROPBOX_REFRESH_TOKEN:'refresh-secret'};
let handler;globalThis.Deno={env:{get:key=>environment[key]},serve:fn=>{handler=fn;}};
const source=readFileSync(new URL('./retailhub-api.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
await import('data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64'));
const id='11111111-1111-4111-8111-111111111111';
const uid='22222222-2222-4222-8222-222222222222';
let role='reader',disabled=false,published=true,oauthExchanges=0;
let settings=new Map(),calls=[];
const user=()=>({id:uid,email:'victor@usuarios.retailhub.invalid',app_metadata:{rh_portal:true,role,disabled}});
const reply=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status});
globalThis.fetch=async(url,init={})=>{
 url=String(url);calls.push({url,init});const u=new URL(url);
 if(u.pathname==='/auth/v1/user')return new Headers(init.headers).get('authorization')==='Bearer valid'?reply(user()):reply({},401);
 if(u.pathname==='/auth/v1/token')return reply({user:user(),access_token:'valid',refresh_token:'rotated',expires_in:3600});
 if(u.pathname.startsWith('/auth/v1/admin/users/'))return reply(user());
 if(u.pathname==='/rest/v1/rh_settings'){
 const key=u.searchParams.get('key')?.slice(3);
 if(init.method==='POST'){const d=JSON.parse(init.body);settings.set(d.key,d.value);return reply(null,201);}
 if(init.method==='DELETE'){const old=settings.get(key);settings.delete(key);return reply(old?[{key,value:old}]:[]);}
 if(key)return reply(settings.has(key)?[{value:settings.get(key)}]:[]);
 return reply([...settings].map(([key,value])=>({key,value})));
 }
 if(u.pathname==='/rest/v1/rh_documents')return reply([{id,dropbox_id:'id:pdf',filename:'Prueba á.pdf',published}]);
 if(u.pathname==='/oauth2/token'){
 const body=new URLSearchParams(init.body);if(body.get('grant_type')==='authorization_code'){oauthExchanges++;return reply({refresh_token:'private-dbx-refresh'});}return reply({access_token:'private-dbx-token',expires_in:14400});
 }
 if(u.pathname==='/2/files/create_folder_v2')return reply({metadata:{'.tag':'folder'}});
 if(u.pathname==='/2/files/upload_session/start')return reply({session_id:'upload-id'});
 if(u.pathname==='/2/files/upload_session/append_v2')return reply(null,200);
 if(u.pathname==='/2/files/upload_session/finish')return reply({'.tag':'file',id:'id:pdf',name:'Prueba á.pdf',path_lower:'/retail hub/portal/planogramas/prueba á.pdf',path_display:'/Retail Hub/Portal/Planogramas/Prueba á.pdf',size:9,rev:'rev-test',server_modified:'2026-10-24T00:00:00Z'});
 if(u.pathname==='/2/files/download'){const range=new Headers(init.headers).get('range');return new Response('%PDF-test',{status:range?206:200,headers:range?{'content-range':'bytes 0-8/9'}:{}});}
 throw Error('Unexpected mock request: '+url);
};
const request=(path,{method='GET',token='valid',body,headers={}}={})=>handler(new Request('https://project.supabase.co/functions/v1/retailhub-api/'+path,{method,headers:{Origin:'https://grupobure.github.io',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}));
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('CORS preflight authorizes GitHub origin',async()=>{const r=await request('documents',{method:'OPTIONS',token:null});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://grupobure.github.io');});
await check('foreign origin cannot log in',async()=>assert.equal((await request('login',{method:'POST',body:{},headers:{Origin:'https://other.example'}})).status,403));
await check('anonymous and invalid sessions cannot list documents',async()=>{assert.equal((await request('documents',{token:null})).status,401);assert.equal((await request('documents',{token:'invalid'})).status,401);});
await check('login returns only user session, never service credentials',async()=>{const r=await request('login',{method:'POST',token:null,body:{username:'victor',password:'password-test'}});assert.equal(r.status,200);const d=await r.json();assert.equal(d.session.access_token,'valid');assert.ok(!JSON.stringify(d).includes('private-test'));});
await check('disabled users cannot log in or use an existing token',async()=>{disabled=true;assert.equal((await request('login',{method:'POST',body:{username:'victor',password:'password-test'}})).status,403);assert.equal((await request('documents')).status,403);disabled=false;});
await check('readers cannot use administrative routes or change publication',async()=>{for(const [path,method,body] of [['users','GET'],['sync','POST',{}],['upload/start','POST',{}],['documents/'+id,'PATCH',{published:false}],['dropbox/connect','POST',{}]])assert.equal((await request(path,{method,body})).status,403);});
await check('reader catalog applies publication filter',async()=>{await request('documents');assert.ok(calls.at(-1).url.includes('published=eq.true'));});
await check('hidden PDFs cannot be linked or downloaded by readers',async()=>{published=false;assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);assert.equal((await request('documents/'+id+'/file')).status,404);published=true;});
let link;
await check('file tickets are hashed at rest and stream partial PDF content',async()=>{const r=await request('documents/'+id+'/link',{method:'POST'});assert.equal(r.status,200);link=await r.json();const token=new URL(link.url).searchParams.get('ticket');assert.ok(![...settings.keys()].some(k=>k.includes(token)));const file=await request(link.url.split('retailhub-api/')[1],{token:null,headers:{Range:'bytes=0-8'}});assert.equal(file.status,206);assert.equal(file.headers.get('content-type'),'application/pdf');assert.equal(file.headers.get('content-range'),'bytes 0-8/9');assert.equal(await file.text(),'%PDF-test');});
await check('issued tickets stop working when user is disabled or PDF hidden',async()=>{disabled=true;assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,403);disabled=false;published=false;assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);published=true;});
await check('expired and fabricated tickets are denied',async()=>{for(const [key,value] of settings)if(key.startsWith('file:'))settings.set(key,JSON.stringify({...JSON.parse(value),expires:1}));assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,403);assert.equal((await request('documents/'+id+'/file?ticket=fake',{token:null})).status,403);});
await check('invalid upload tickets and oversized JSON fail safely',async()=>{role='admin';assert.equal((await request('upload/chunk',{method:'POST',body:'x',headers:{'X-Upload-Ticket':'fake'}})).status,403);assert.equal((await request('login',{method:'POST',body:'x'.repeat(17000)})).status,413);});
await check('admin upload accepts PDF chunks and commits metadata; invalid first bytes are denied',async()=>{
 const start=await request('upload/start',{method:'POST',body:{filename:'Prueba á.pdf',category:'Planogramas'}});assert.equal(start.status,200);const {ticket}=await start.json();
 const headers={'X-Upload-Ticket':ticket,'X-Upload-Offset':'0'};
 assert.equal((await request('upload/chunk',{method:'POST',headers,body:'html'})).status,400);
 assert.equal((await request('upload/chunk',{method:'POST',headers,body:'%PDF-test'})).status,200);
 assert.equal((await request('upload/finish',{method:'POST',headers:{...headers,'X-Upload-Offset':'9'},body:''})).status,200);
 const saved=JSON.parse(calls.at(-1).init.body);assert.equal(saved.filename,'Prueba á.pdf');assert.equal(saved.category,'Planogramas');assert.equal(saved.published,undefined);
});
await check('Dropbox OAuth validates state, consumes it once and encrypts refresh token',async()=>{const r=await request('dropbox/connect',{method:'POST'});assert.equal(r.status,200);const state=new URL((await r.json()).url).searchParams.get('state');const callback='dropbox/callback?code=example&state='+encodeURIComponent(state);assert.equal((await request('dropbox/callback?code=example&state=fake',{token:null})).status,403);const result=await request(callback,{token:null});assert.equal(result.status,302);assert.equal(result.headers.get('location'),'https://grupobure.github.io/RetailHub/BibliotecaPlanog/?conexion=dropbox');assert.notEqual(settings.get('dropbox_refresh'),'private-dbx-refresh');assert.equal((await request(callback,{token:null})).status,403);assert.equal(oauthExchanges,1);});
await check('new injected Supabase API keys are supported',async()=>{delete environment.SUPABASE_ANON_KEY;delete environment.SUPABASE_SERVICE_ROLE_KEY;environment.SUPABASE_PUBLISHABLE_KEYS=JSON.stringify({default:'sb_publishable_example'});environment.SUPABASE_SECRET_KEYS=JSON.stringify({default:'sb_secret_example'});await request('documents');const h=new Headers(calls.at(-1).init.headers);assert.equal(h.get('apikey'),'sb_secret_example');assert.equal(h.get('authorization'),null);});
console.log(`${checks} security and integration checks passed (mocked services).`);
