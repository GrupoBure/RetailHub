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
const otherId='33333333-3333-4333-8333-333333333333';
let target={id:otherId,email:'lector@usuarios.retailhub.invalid',user_metadata:{name:'Lector',department:'Montaje'},app_metadata:{rh_portal:true,role:'reader',disabled:false,custom_flag:'keep'}};
let targetDeleted=false;
const uid='22222222-2222-4222-8222-222222222222';
const storeA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',storeB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let userStoreIds=[storeA],fileStore='a',folderMoved=false;
const storeRows=[{id:storeA,name:'Tienda A',enabled:true,dropbox_id:'id:store-a',path_lower:'/retail hub/portal/tienda a'},{id:storeB,name:'Tienda B',enabled:true,dropbox_id:'id:store-b',path_lower:'/retail hub/portal/tienda b'}];
let role='reader',disabled=false,published=true,oauthExchanges=0;
let settings=new Map(),calls=[],createdFolders=new Map();
const user=()=>({id:uid,email:'victor@usuarios.retailhub.invalid',user_metadata:{store_ids:[storeB],role:'admin'},app_metadata:{rh_portal:true,role,disabled,store_ids:userStoreIds}});
const reply=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status});
globalThis.fetch=async(url,init={})=>{
 url=String(url);calls.push({url,init});const u=new URL(url);
 if(u.pathname==='/auth/v1/user')return new Headers(init.headers).get('authorization')==='Bearer valid'?reply(user()):reply({},401);
 if(u.pathname==='/auth/v1/token')return reply({user:user(),access_token:'valid',refresh_token:'rotated',expires_in:3600});
 if(u.pathname==='/auth/v1/admin/users'&&init.method==='POST')return reply({id:otherId,...JSON.parse(init.body)});
 if(u.pathname.startsWith('/auth/v1/admin/users/')){
 const targetId=u.pathname.split('/').at(-1);if(targetId===uid)return reply(user());
 if(targetDeleted||targetId!==otherId)return reply({},404);
 if(init.method==='DELETE'){targetDeleted=true;return reply(target);}
 if(init.method==='PUT'){const change=JSON.parse(init.body);if(change.email==='duplicado@usuarios.retailhub.invalid')return reply({code:'email_exists'},422);target={...target,...change};return reply(target);}
 return reply(target);
 }
 if(u.pathname==='/rest/v1/rh_settings'){
 const key=u.searchParams.get('key')?.slice(3);
 if(init.method==='POST'){const d=JSON.parse(init.body);settings.set(d.key,d.value);return reply(null,201);}
 if(init.method==='DELETE'){const old=settings.get(key);settings.delete(key);return reply(old?[{key,value:old}]:[]);}
 if(key)return reply(settings.has(key)?[{value:settings.get(key)}]:[]);
 return reply([...settings].map(([key,value])=>({key,value})));
 }
 if(u.pathname==='/rest/v1/rh_stores'){
 if(init.method==='POST'){const d=JSON.parse(init.body);const found=storeRows.find(v=>v.dropbox_id===d.dropbox_id);if(found)Object.assign(found,d);else storeRows.push({...d,id:crypto.randomUUID(),enabled:true});return reply([found||storeRows.at(-1)]);}
 let rows=[...storeRows];const ids=u.searchParams.get('id');if(ids?.startsWith('eq.'))rows=rows.filter(v=>v.id===ids.slice(3));if(ids?.startsWith('in.'))rows=rows.filter(v=>ids.slice(4,-1).split(',').includes(v.id));if(u.searchParams.get('enabled')==='eq.true')rows=rows.filter(v=>v.enabled);return reply(rows);
 }
 if(u.pathname==='/rest/v1/rh_documents'){
 if(init.method==='POST')return reply(null,201);
 const selected=u.searchParams.get('store_id');if(selected&&selected!=='eq.'+storeA)return reply([]);
 return reply([{id,store_id:storeA,dropbox_id:'id:pdf',filename:'Prueba á.pdf',published}]);}
 if(u.pathname==='/oauth2/token'){
 const body=new URLSearchParams(init.body);if(body.get('grant_type')==='authorization_code'){oauthExchanges++;return reply({refresh_token:'private-dbx-refresh'});}return reply({access_token:'private-dbx-token',expires_in:14400});
 }
 if(u.pathname==='/2/files/create_folder_v2'){
 const path=JSON.parse(init.body).path,lower=path.toLowerCase();
 if(createdFolders.has(lower)||storeRows.some(v=>v.path_lower===lower))return reply({error_summary:'path/conflict/folder/'},409);
 const metadata={id:'id:created:'+lower,name:path.split('/').at(-1),path_lower:lower,path_display:path};createdFolders.set(lower,metadata);
 // Dropbox's concrete FolderMetadata response does not have a .tag discriminator.
 return reply({metadata});
 }
 if(u.pathname==='/2/files/get_metadata'){
 const path=JSON.parse(init.body).path;
 if(path==='id:pdf')return reply({'.tag':'file',id:'id:pdf',name:'Prueba á.pdf',path_lower:'/retail hub/portal/tienda '+fileStore+'/planogramas/prueba á.pdf'});
 const store=storeRows.find(v=>v.dropbox_id===path||v.path_lower===path.toLowerCase());if(store)return reply({'.tag':'folder',id:store.dropbox_id,name:store.name,path_lower:folderMoved?'/otra carpeta/'+store.name:store.path_lower,path_display:'/Retail Hub/Portal/'+store.name});
 if(createdFolders.has(path.toLowerCase()))return reply({...createdFolders.get(path.toLowerCase()),'.tag':'folder'});
 throw Error('Unexpected metadata path: '+path);
 }
 if(u.pathname==='/2/files/list_folder')return reply({entries:[{'.tag':'folder',id:'id:store-a',name:'Tienda A',path_lower:'/retail hub/portal/tienda a',path_display:'/Retail Hub/Portal/Tienda A'},{'.tag':'file',id:'id:pdf',name:'Prueba á.pdf',path_lower:'/retail hub/portal/tienda a/planogramas/prueba á.pdf',path_display:'/Retail Hub/Portal/Tienda A/Planogramas/Prueba á.pdf',size:9,rev:'rev-test',server_modified:'2026-10-24T00:00:00Z'}],has_more:false});
 if(u.pathname==='/2/files/upload_session/start')return reply({session_id:'upload-id'});
 if(u.pathname==='/2/files/upload_session/append_v2')return reply(null,200);
 if(u.pathname==='/2/files/upload_session/finish')return reply({'.tag':'file',id:'id:pdf',name:'Prueba á.pdf',path_lower:'/retail hub/portal/tienda a/planogramas/prueba á.pdf',path_display:'/Retail Hub/Portal/Tienda A/Planogramas/Prueba á.pdf',size:9,rev:'rev-test',server_modified:'2026-10-24T00:00:00Z'});
 if(u.pathname==='/2/files/download'){const range=new Headers(init.headers).get('range');return new Response('%PDF-test',{status:range?206:200,headers:range?{'content-range':'bytes 0-8/9'}:{}});}
 throw Error('Unexpected mock request: '+url);
};
const request=(path,{method='GET',token='valid',body,headers={}}={})=>handler(new Request('https://project.supabase.co/functions/v1/retailhub-api/'+path,{method,headers:{Origin:'https://grupobure.github.io',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}));
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('CORS preflight authorizes GitHub origin',async()=>{const r=await request('documents?store='+storeA,{method:'OPTIONS',token:null});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://grupobure.github.io');});
await check('foreign origin cannot log in',async()=>assert.equal((await request('login',{method:'POST',body:{},headers:{Origin:'https://other.example'}})).status,403));
await check('anonymous and invalid sessions cannot list documents',async()=>{assert.equal((await request('documents?store='+storeA,{token:null})).status,401);assert.equal((await request('documents?store='+storeA,{token:'invalid'})).status,401);});
await check('login returns only user session, never service credentials',async()=>{const r=await request('login',{method:'POST',token:null,body:{username:'victor',password:'password-test'}});assert.equal(r.status,200);const d=await r.json();assert.equal(d.session.access_token,'valid');assert.ok(!JSON.stringify(d).includes('private-test'));});
await check('disabled users cannot log in or use an existing token',async()=>{disabled=true;assert.equal((await request('login',{method:'POST',body:{username:'victor',password:'password-test'}})).status,403);assert.equal((await request('documents?store='+storeA)).status,403);disabled=false;});
await check('readers cannot use administrative routes or change publication',async()=>{for(const [path,method,body] of [['users','GET'],['sync','POST',{}],['upload/start','POST',{}],['documents/'+id,'PATCH',{published:false}],['dropbox/connect','POST',{}]])assert.equal((await request(path,{method,body})).status,403);});
await check('reader catalog applies publication filter',async()=>{await request('documents?store='+storeA);assert.ok(calls.at(-1).url.includes('published=eq.true'));});
await check('hidden PDFs cannot be linked or downloaded by readers',async()=>{published=false;assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);assert.equal((await request('documents/'+id+'/file')).status,404);published=true;});
let link;
await check('file tickets are hashed at rest and stream partial PDF content',async()=>{const r=await request('documents/'+id+'/link',{method:'POST'});assert.equal(r.status,200);link=await r.json();const token=new URL(link.url).searchParams.get('ticket');assert.ok(![...settings.keys()].some(k=>k.includes(token)));const file=await request(link.url.split('retailhub-api/')[1],{token:null,headers:{Range:'bytes=0-8'}});assert.equal(file.status,206);assert.equal(file.headers.get('content-type'),'application/pdf');assert.equal(file.headers.get('content-range'),'bytes 0-8/9');assert.equal(await file.text(),'%PDF-test');});
await check('issued tickets stop working when user is disabled or PDF hidden',async()=>{disabled=true;assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,403);disabled=false;published=false;assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);published=true;});
await check('expired and fabricated tickets are denied',async()=>{for(const [key,value] of settings)if(key.startsWith('file:'))settings.set(key,JSON.stringify({...JSON.parse(value),expires:1}));assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,403);assert.equal((await request('documents/'+id+'/file?ticket=fake',{token:null})).status,403);});
await check('invalid upload tickets and oversized JSON fail safely',async()=>{role='admin';assert.equal((await request('upload/chunk',{method:'POST',body:'x',headers:{'X-Upload-Ticket':'fake'}})).status,403);assert.equal((await request('login',{method:'POST',body:'x'.repeat(17000)})).status,413);});
await check('admin upload accepts PDF chunks and commits metadata; invalid first bytes are denied',async()=>{
 const start=await request('upload/start',{method:'POST',body:{filename:'Prueba á.pdf',category:'Planogramas',store_id:storeA}});assert.equal(start.status,200);const {ticket}=await start.json();
 const headers={'X-Upload-Ticket':ticket,'X-Upload-Offset':'0'};
 assert.equal((await request('upload/chunk',{method:'POST',headers,body:'html'})).status,400);
 assert.equal((await request('upload/chunk',{method:'POST',headers,body:'%PDF-test'})).status,200);
 assert.equal((await request('upload/finish',{method:'POST',headers:{...headers,'X-Upload-Offset':'9'},body:''})).status,200);
 const saved=JSON.parse(calls.at(-1).init.body);assert.equal(saved.filename,'Prueba á.pdf');assert.equal(saved.category,'Planogramas');assert.equal(saved.published,undefined);
});
await check('Dropbox OAuth validates state, consumes it once and encrypts refresh token',async()=>{const r=await request('dropbox/connect',{method:'POST'});assert.equal(r.status,200);const state=new URL((await r.json()).url).searchParams.get('state');const callback='dropbox/callback?code=example&state='+encodeURIComponent(state);assert.equal((await request('dropbox/callback?code=example&state=fake',{token:null})).status,403);const result=await request(callback,{token:null});assert.equal(result.status,302);assert.equal(result.headers.get('location'),'https://grupobure.github.io/RetailHub/BibliotecaPlanog/?conexion=dropbox');assert.notEqual(settings.get('dropbox_refresh'),'private-dbx-refresh');assert.equal((await request(callback,{token:null})).status,403);assert.equal(oauthExchanges,1);});
await check('anonymous, reader and disabled admin cannot edit or delete users',async()=>{
 role='reader';for(const method of ['PATCH','DELETE']){assert.equal((await request('users/'+otherId,{method,body:{name:'X',confirm_username:'lector'}})).status,403);assert.equal((await request('users/'+otherId,{method,token:null,body:{}})).status,401);}
 role='admin';disabled=true;assert.equal((await request('users/'+otherId,{method:'DELETE',body:{confirm_username:'lector'}})).status,403);disabled=false;
});
await check('editing updates username, name and role while preserving metadata and password',async()=>{
 const r=await request('users/'+otherId,{method:'PATCH',body:{name:'Coordinador',username:'coordinador.01',role:'admin'}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.user.username,'coordinador.01');assert.equal(data.user.name,'Coordinador');assert.equal(data.user.role,'admin');assert.equal(target.email_confirm,true);assert.equal(target.user_metadata.department,'Montaje');assert.equal(target.app_metadata.custom_flag,'keep');assert.equal(target.app_metadata.rh_portal,true);assert.ok(!('password' in JSON.parse(calls.at(-1).init.body)));assert.ok(!('password' in data.user));
});
await check('invalid names, usernames and roles cannot modify a user',async()=>{
 for(const body of [{name:'   '},{name:'x'.repeat(101)},{username:'../bad'},{role:'owner'}])assert.equal((await request('users/'+otherId,{method:'PATCH',body})).status,400);
});
await check('duplicate usernames return a clear conflict response',async()=>assert.equal((await request('users/'+otherId,{method:'PATCH',body:{username:'duplicado'}})).status,409));
await check('admin cannot delete, disable or demote their own account',async()=>{
 for(const [method,body] of [['DELETE',{confirm_username:'victor'}],['PATCH',{enabled:false}],['PATCH',{role:'reader'}]])assert.equal((await request('users/'+uid,{method,body})).status,400);
});
await check('password reset validates length and does not return the password',async()=>{
 assert.equal((await request('users/'+otherId,{method:'PATCH',body:{password:'short'}})).status,400);
 const r=await request('users/'+otherId,{method:'PATCH',body:{password:'new-test-password'}});assert.equal(r.status,200);assert.ok(!(await r.text()).includes('new-test-password'));assert.equal(target.password,'new-test-password');
});
await check('non-portal accounts cannot be edited or deleted',async()=>{
 target.app_metadata.rh_portal=false;for(const method of ['PATCH','DELETE'])assert.equal((await request('users/'+otherId,{method,body:{name:'X',confirm_username:'coordinador.01'}})).status,404);target.app_metadata.rh_portal=true;
});
await check('delete requires matching username and preserves documents',async()=>{
 let at=calls.length;assert.equal((await request('users/'+otherId,{method:'DELETE',body:{confirm_username:'wrong'}})).status,400);assert.ok(!calls.slice(at).some(c=>c.init.method==='DELETE'));assert.equal(targetDeleted,false);
 at=calls.length;assert.equal((await request('users/'+otherId,{method:'DELETE',body:{confirm_username:'coordinador.01'}})).status,200);assert.equal(targetDeleted,true);assert.ok(!calls.slice(at).some(c=>c.url.includes('rh_documents')));
});
await check('CORS preflight supports DELETE',async()=>{const r=await request('users/'+otherId,{method:'OPTIONS',token:null});assert.ok(r.headers.get('access-control-allow-methods').includes('DELETE'));});
await check('store list contains only assigned stores; an unassigned reader sees none',async()=>{
 role='reader';userStoreIds=[storeA];let d=await (await request('stores')).json();assert.deepEqual(d.stores.map(v=>v.id),[storeA]);assert.ok(!JSON.stringify(d).includes('dropbox_id'));
 userStoreIds=[];d=await (await request('stores')).json();assert.deepEqual(d.stores,[]);assert.equal((await request('documents?store='+storeA)).status,404);assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);userStoreIds=[storeA];
});
await check('unselected library never lists all documents, including for admins',async()=>{
 assert.deepEqual(await (await request('documents')).json(),{documents:[]});role='admin';assert.deepEqual(await (await request('documents')).json(),{documents:[]});role='reader';
});
await check('reader cannot list another store or request a link or file from it',async()=>{
 userStoreIds=[storeB];assert.equal((await request('documents?store='+storeA)).status,404);assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);assert.equal((await request('documents/'+id+'/file')).status,404);userStoreIds=[storeA];
});
await check('revoking store access invalidates a previously issued file ticket',async()=>{
 const link=await (await request('documents/'+id+'/link',{method:'POST'})).json();userStoreIds=[];assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);userStoreIds=[storeA];
});
await check('disabled stores cannot be listed or accessed by readers',async()=>{
 storeRows[0].enabled=false;assert.deepEqual((await (await request('stores')).json()).stores,[]);assert.equal((await request('documents?store='+storeA)).status,404);assert.equal((await request('documents/'+id+'/file')).status,404);storeRows[0].enabled=true;
});
await check('moving a PDF to another store blocks its former permission even before sync',async()=>{
 fileStore='b';assert.equal((await request('documents/'+id+'/file')).status,404);assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);fileStore='a';
 folderMoved=true;assert.equal((await request('documents/'+id+'/file')).status,404);folderMoved=false;
});
await check('readers cannot create stores or grant themselves stores',async()=>{
 assert.equal((await request('stores',{method:'POST',body:{name:'Unauthorized'}})).status,403);
 assert.equal((await request('users/'+uid,{method:'PATCH',body:{store_ids:[storeB]}})).status,403);
});
await check('admins see all stores and can validate and assign multiple stores to a reader',async()=>{
 role='admin';assert.equal((await (await request('stores')).json()).stores.length,2);targetDeleted=false;
 let r=await request('users/'+otherId,{method:'PATCH',body:{store_ids:[storeA,storeB],role:'reader'}});assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.user.store_ids,[storeA,storeB]);assert.equal(target.app_metadata.role,'reader');assert.equal(target.app_metadata.custom_flag,'keep');
 r=await request('users/'+otherId,{method:'PATCH',body:{store_ids:[]}});assert.equal(r.status,200);assert.deepEqual((await r.json()).user.store_ids,[]);
 for(const ids of [['bad'],['dddddddd-dddd-4ddd-8ddd-dddddddddddd'],[storeA,'bad']])assert.equal((await request('users/'+otherId,{method:'PATCH',body:{store_ids:ids}})).status,400);
 storeRows[1].enabled=false;assert.equal((await request('users/'+otherId,{method:'PATCH',body:{store_ids:[storeB]}})).status,400);storeRows[1].enabled=true;
});
await check('sync associates files to stable store IDs and preserves publication and user grants',async()=>{
 const r=await request('sync',{method:'POST',body:{}});assert.equal(r.status,200);const write=calls.filter(c=>new URL(c.url).pathname==='/rest/v1/rh_documents'&&c.init.method==='POST').at(-1);const row=JSON.parse(write.init.body)[0];assert.equal(row.store_id,storeA);assert.equal(row.category,'Planogramas');assert.equal(row.published,undefined);assert.ok(!calls.slice(-5).some(c=>c.url.includes('/admin/users')));
});
await check('upload requires a store and cannot use invalid store IDs',async()=>{
 for(const store_id of [undefined,'bad','dddddddd-dddd-4ddd-8ddd-dddddddddddd'])assert.equal((await request('upload/start',{method:'POST',body:{filename:'test.pdf',category:'General',store_id}})).status,404);
});
await check('admin store creation creates a Dropbox folder without granting reader access',async()=>{
 const r=await request('stores',{method:'POST',body:{name:'Tienda nueva'}});assert.equal(r.status,201);const created=(await r.json()).store;assert.equal(created.name,'Tienda nueva');assert.ok(!userStoreIds.includes(created.id));assert.equal((await request('stores',{method:'POST',body:{name:'../escape'}})).status,400);
});
await check('retrying an existing store reuses its folder and permissions instead of duplicating it',async()=>{
 const store=storeRows.find(v=>v.name==='Tienda nueva');const before=storeRows.length;const r=await request('stores',{method:'POST',body:{name:'Tienda nueva'}});assert.equal(r.status,201);assert.equal((await r.json()).store.id,store.id);assert.equal(storeRows.length,before);assert.ok(!userStoreIds.includes(store.id));
});
await check('store creation accepts accented names with actual untagged FolderMetadata',async()=>{
 const r=await request('stores',{method:'POST',body:{name:'BK Martín Carrera'}});assert.equal(r.status,201);const store=(await r.json()).store;assert.equal(store.name,'BK Martín Carrera');assert.equal(storeRows.find(v=>v.id===store.id).path_lower,'/retail hub/portal/bk martín carrera');
});
await check('new readers default to zero stores and invalid assignments cannot create accounts',async()=>{
 role='admin';let r=await request('users',{method:'POST',body:{username:'nuevo.lector',name:'Nuevo lector',password:'test-password-123'}});assert.equal(r.status,201);assert.deepEqual((await r.json()).user.store_ids,[]);
 r=await request('users',{method:'POST',body:{username:'nuevo.lector',password:'test-password-123',store_ids:[storeA]}});assert.equal(r.status,201);assert.deepEqual((await r.json()).user.store_ids,[storeA]);
 const count=calls.filter(c=>new URL(c.url).pathname==='/auth/v1/admin/users'&&c.init.method==='POST').length;
 r=await request('users',{method:'POST',body:{username:'bad.lector',password:'test-password-123',store_ids:['fake']}});assert.equal(r.status,400);assert.equal(calls.filter(c=>new URL(c.url).pathname==='/auth/v1/admin/users'&&c.init.method==='POST').length,count);
});
await check('editable user metadata cannot grant stores or admin permissions',async()=>{
 role='reader';userStoreIds=[];assert.deepEqual((await (await request('stores')).json()).stores,[]);assert.equal((await request('stores',{method:'POST',body:{name:'Fake'}})).status,403);assert.equal((await request('documents?store='+storeB)).status,404);userStoreIds=[storeA];role='admin';
});
await check('new injected Supabase API keys are supported',async()=>{delete environment.SUPABASE_ANON_KEY;delete environment.SUPABASE_SERVICE_ROLE_KEY;environment.SUPABASE_PUBLISHABLE_KEYS=JSON.stringify({default:'sb_publishable_example'});environment.SUPABASE_SECRET_KEYS=JSON.stringify({default:'sb_secret_example'});await request('documents?store='+storeA);const h=new Headers(calls.at(-1).init.headers);assert.equal(h.get('apikey'),'sb_secret_example');assert.equal(h.get('authorization'),null);});
console.log(`${checks} security and integration checks passed (mocked services).`);
