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
const apiModule=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64'));
const id='11111111-1111-4111-8111-111111111111';
const otherId='33333333-3333-4333-8333-333333333333';
let target={id:otherId,email:'lector@usuarios.retailhub.invalid',user_metadata:{name:'Lector',department:'Montaje'},app_metadata:{rh_portal:true,role:'reader',disabled:false,custom_flag:'keep'}};
let targetDeleted=false;
const uid='22222222-2222-4222-8222-222222222222';
const storeA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',storeB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let userStoreIds=[storeA],fileStore='a',folderMoved=false,currentFilename='Prueba á.pdf',currentSection='Planogramas',catalogOverride=null;
const storeRows=[{id:storeA,name:'Tienda A',enabled:true,dropbox_id:'id:store-a',path_lower:'/retail hub/portal/tienda a'},{id:storeB,name:'Tienda B',enabled:true,dropbox_id:'id:store-b',path_lower:'/retail hub/portal/tienda b'}];
let documentDeleted=false,dropboxFileDeleted=false,deleteDropboxFailure=false,deleteDatabaseFailure=false,metadataFolder=false,liveFilename='',fileRevision='a1c10ce0dd78';
let role='reader',disabled=false,published=true,oauthExchanges=0;
let dashboards=new Map(),dashboardTemplates=new Map(),quoteBoards=new Map(),quoteTemplates=new Map(),quoteApprovals=[];
let quotePermission=false,quoteViewStores=[],quoteApproveStores=[],quoteFileDbFailure=false;
const quoteFileRows=new Map(),quoteFileMeta=new Map();
let settings=new Map(),calls=[],createdFolders=new Map(),folderOverrides=new Map(),failNextMoveTo='';
const user=()=>({id:uid,email:'victor@usuarios.retailhub.invalid',user_metadata:{store_ids:[storeB],role:'admin'},app_metadata:{rh_portal:true,role,disabled,quote_approval:quotePermission,quote_view_store_ids:quoteViewStores,quote_approve_store_ids:quoteApproveStores,store_ids:userStoreIds}});
const reply=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status});
globalThis.fetch=async(url,init={})=>{
 url=String(url);calls.push({url,init});const u=new URL(url);
 if(u.pathname==='/auth/v1/user')return new Headers(init.headers).get('authorization')==='Bearer valid'?reply(user()):reply({},401);
 if(u.pathname==='/auth/v1/token')return reply({user:user(),access_token:'valid',refresh_token:'rotated',expires_in:3600});
 if(u.pathname==='/auth/v1/admin/users'&&init.method==='POST')return reply({id:otherId,...JSON.parse(init.body)});
 if(u.pathname.startsWith('/auth/v1/admin/users/')){
 const targetId=u.pathname.split('/').at(-1);if(targetId===uid){if(init.method==='PUT'){const change=JSON.parse(init.body);if(change.app_metadata?.quote_approval!==undefined)quotePermission=change.app_metadata.quote_approval;if(change.app_metadata?.quote_view_store_ids)quoteViewStores=change.app_metadata.quote_view_store_ids;if(change.app_metadata?.quote_approve_store_ids)quoteApproveStores=change.app_metadata.quote_approve_store_ids;return reply({...user(),...change});}return reply(user());}
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
 if(u.pathname==='/rest/v1/rh_quote_boards'){
 const id=u.searchParams.get('id')?.slice(3),fields=u.searchParams.get('select')?.split(',');const project=d=>Object.fromEntries((fields||Object.keys(d)).map(k=>[k,d[k]]));
 if(init.method==='POST'){const d={...JSON.parse(init.body),id:crypto.randomUUID(),updated_at:new Date().toISOString()};quoteBoards.set(d.id,d);return reply([project(d)],201);}
 if(init.method==='PATCH'){const old=quoteBoards.get(id);if(!old||old.deleted_at||old.revision!==Number(u.searchParams.get('revision')?.slice(3)))return reply([]);const d={...old,...JSON.parse(init.body)};quoteBoards.set(id,d);return reply([project(d)]);}
 let rows=[...quoteBoards.values()];if(u.searchParams.get('deleted_at')==='is.null')rows=rows.filter(v=>!v.deleted_at);if(id)rows=rows.filter(v=>v.id===id);if(u.searchParams.get('store_id'))rows=rows.filter(v=>v.store_id===u.searchParams.get('store_id').slice(3));if(u.searchParams.get('published')==='eq.true')rows=rows.filter(v=>v.published);return reply(rows.map(project));
 }
 if(u.pathname==='/rest/v1/rpc/rh_remove_quote'){
 const b=JSON.parse(init.body),board=quoteBoards.get(b.p_board);if(role!=='admin'||disabled)return reply({message:'quote_access'},400);if(!board||board.deleted_at||board.revision!==b.p_revision)return reply({message:'quote_conflict'},400);if(quoteApprovals.some(a=>a.board_id===board.id))return reply({message:'quote_has_approvals'},400);board.deleted_at=new Date().toISOString();board.published=false;board.revision++;return reply(null,204);
 }
 if(u.pathname==='/rest/v1/rh_quote_templates'){
 const fields=u.searchParams.get('select')?.split(','),project=d=>Object.fromEntries((fields||Object.keys(d)).map(k=>[k,d[k]]));const id=u.searchParams.get('id');
 if(init.method==='POST'){const d={...JSON.parse(init.body),id:crypto.randomUUID(),created_at:new Date().toISOString()};quoteTemplates.set(d.id,d);return reply([project(d)],201);}
 if(init.method==='PATCH'){const old=quoteTemplates.get(id?.slice(3));if(!old||old.deleted_at||old.revision!==Number(u.searchParams.get('revision')?.slice(3)))return reply([]);Object.assign(old,JSON.parse(init.body));return reply([project(old)]);}
 let rows=[...quoteTemplates.values()].filter(v=>!v.deleted_at).sort((a,b)=>b.id.localeCompare(a.id));if(id?.startsWith('eq.'))rows=rows.filter(v=>v.id===id.slice(3));if(id?.startsWith('lt.'))rows=rows.filter(v=>v.id<id.slice(3));return reply(rows.slice(0,100).map(project));
 }
 if(u.pathname==='/rest/v1/rh_quote_files'){
 if(init.method==='POST'){if(quoteFileDbFailure){quoteFileDbFailure=false;return reply({},503);}const d=JSON.parse(init.body);quoteFileRows.set(d.id,d);return reply(null,201);}
 let rows=[...quoteFileRows.values()];if(u.searchParams.get('id'))rows=rows.filter(v=>v.id===u.searchParams.get('id').slice(3));if(u.searchParams.get('board_id'))rows=rows.filter(v=>v.board_id===u.searchParams.get('board_id').slice(3));return reply(rows);
 }

 if(u.pathname==='/rest/v1/rh_quote_approvals')return reply(quoteApprovals.filter(v=>v.board_id===u.searchParams.get('board_id')?.slice(3)&&(!u.searchParams.get('id')||v.id===u.searchParams.get('id').slice(3))).map(v=>u.searchParams.get('select')?.includes('snapshot')?{...v,snapshot:{data:v.snapshot,offer_id:v.offer_id}}:(({snapshot,...rest})=>rest)(v)));
 if(u.pathname==='/rest/v1/rpc/rh_approve_quote'){
 const b=JSON.parse(init.body),board=quoteBoards.get(b.p_board);if(!board||board.deleted_at||!board.published||board.revision!==b.p_revision||quoteApprovals.some(a=>a.board_id===board.id&&a.board_revision===board.revision))return reply({message:'quote_conflict',code:'23505'},409);
 assert.equal(b.p_user,uid);const d={id:crypto.randomUUID(),board_id:board.id,board_revision:board.revision,offer_id:b.p_offer,approved_name:b.p_name,approved_at:new Date().toISOString(),snapshot:structuredClone(board.data)};quoteApprovals.push(d);return reply(d.id);
 }
 if(u.pathname==='/rest/v1/rh_dashboard_templates'){
 const fields=u.searchParams.get('select')?.split(',');
 const project=d=>Object.fromEntries((fields||Object.keys(d)).map(k=>[k,d[k]]));
 if(init.method==='POST'){const data={...JSON.parse(init.body),id:crypto.randomUUID(),created_at:new Date().toISOString()};dashboardTemplates.set(data.id,data);return reply([project(data)],201);}
 let rows=[...dashboardTemplates.values()].sort((a,b)=>b.id.localeCompare(a.id));const idFilter=u.searchParams.get('id');if(idFilter?.startsWith('eq.'))rows=rows.filter(v=>v.id===idFilter.slice(3));if(idFilter?.startsWith('lt.'))rows=rows.filter(v=>v.id<idFilter.slice(3));return reply(rows.slice(0,100).map(project));
 }
 if(u.pathname==='/rest/v1/rh_dashboards'){
 const store=u.searchParams.get('store_id')?.slice(3);
 if(init.method==='POST'){const d=JSON.parse(init.body);if(dashboards.has(d.store_id))return reply([]);dashboards.set(d.store_id,d);return reply([d],201);}
 if(init.method==='PATCH'){const old=dashboards.get(store);if(!old||old.revision!==Number(u.searchParams.get('revision')?.slice(3)))return reply([]);const d={...old,...JSON.parse(init.body)};dashboards.set(store,d);return reply([d]);}
 return reply(dashboards.has(store)?[dashboards.get(store)]:[]);
 }
 if(u.pathname==='/rest/v1/rh_stores'){
 if(init.method==='PATCH'){const id=u.searchParams.get('id')?.slice(3);const store=storeRows.find(v=>v.id===id);assert.ok(store);Object.assign(store,JSON.parse(init.body));return reply(null,204);}
 if(init.method==='POST'){const d=JSON.parse(init.body);const found=storeRows.find(v=>v.dropbox_id===d.dropbox_id);if(found)Object.assign(found,d);else storeRows.push({...d,id:crypto.randomUUID(),enabled:true});return reply([found||storeRows.at(-1)]);}
 let rows=[...storeRows];const ids=u.searchParams.get('id');if(ids?.startsWith('eq.'))rows=rows.filter(v=>v.id===ids.slice(3));if(ids?.startsWith('in.'))rows=rows.filter(v=>ids.slice(4,-1).split(',').includes(v.id));if(u.searchParams.get('enabled')==='eq.true')rows=rows.filter(v=>v.enabled);return reply(rows);
 }
 if(u.pathname==='/rest/v1/rh_documents'){
 if(init.method==='DELETE'){if(deleteDatabaseFailure){deleteDatabaseFailure=false;return reply({},503);}documentDeleted=true;return reply(null,204);}
 if(documentDeleted&&init.method!=='POST')return reply([]);
 if(init.method==='POST')return reply(null,201);
 const selected=u.searchParams.get('store_id');if(selected&&selected!=='eq.'+storeA)return reply([]);
 return reply(catalogOverride||[{id,store_id:storeA,dropbox_id:'id:pdf',filename:currentFilename,category:currentSection,published}]);}
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
 if(quoteFileMeta.has(path))return reply(quoteFileMeta.get(path));
 if(path.toLowerCase().includes('/cotizaciones/')&&!createdFolders.has(path.toLowerCase()))return reply({error_summary:'path/not_found/'},409);
 if(path==='id:pdf'&&dropboxFileDeleted)return reply({error_summary:'path/not_found/'},409);
 if(path==='id:pdf')return reply({'.tag':metadataFolder?'folder':'file',id:'id:pdf',rev:fileRevision,name:liveFilename||currentFilename,path_lower:(folderOverrides.get('id:store-'+fileStore)?.path_lower||'/retail hub/portal/tienda '+fileStore)+'/'+currentSection.toLowerCase()+'/'+currentFilename.toLowerCase()});
 const store=storeRows.find(v=>v.dropbox_id===path||v.path_lower===path.toLowerCase());if(store&&folderOverrides.has(store.dropbox_id))return reply(folderOverrides.get(store.dropbox_id));if(store)return reply({'.tag':'folder',id:store.dropbox_id,name:store.name,path_lower:folderMoved?'/otra carpeta/'+store.name:store.path_lower,path_display:'/Retail Hub/Portal/'+store.name});
 if(createdFolders.has(path.toLowerCase()))return reply({...createdFolders.get(path.toLowerCase()),'.tag':'folder'});
 throw Error('Unexpected metadata path: '+path);
 }
 if(u.pathname==='/2/files/delete_v2'){
 const b=JSON.parse(init.body);assert.equal(b.path,'id:pdf');assert.equal(b.parent_rev,fileRevision);assert.equal(metadataFolder,false);
 if(deleteDropboxFailure)return reply({error_summary:'no_write_permission/'},403);
 if(dropboxFileDeleted)return reply({error_summary:'path_lookup/not_found/'},409);dropboxFileDeleted=true;return reply({metadata:{'.tag':'file',id:'id:pdf',name:currentFilename,rev:fileRevision}});
 }
 if(u.pathname==='/2/files/move_v2'){
 const b=JSON.parse(init.body);assert.equal(b.autorename,false);assert.ok(b.from_path.startsWith('id:'));
 const store=storeRows.find(v=>v.dropbox_id===b.from_path);assert.ok(store);const current=folderOverrides.get(store.dropbox_id)||{'.tag':'folder',id:store.dropbox_id,name:store.name,path_lower:store.path_lower,path_display:'/Retail Hub/Portal/'+store.name};
 if(b.to_path===failNextMoveTo){failNextMoveTo='';return reply({error_summary:'to/conflict/folder/'},409);}
 if(current.path_lower===b.to_path.toLowerCase()||storeRows.some(v=>v.dropbox_id!==store.dropbox_id&&v.path_lower===b.to_path.toLowerCase()))return reply({error_summary:'to/conflict/folder/'},409);
 const metadata={...current,name:b.to_path.split('/').at(-1),path_lower:b.to_path.toLowerCase(),path_display:b.to_path};folderOverrides.set(store.dropbox_id,metadata);return reply({metadata});
 }
 if(u.pathname==='/2/files/list_folder')return reply({entries:[{'.tag':'folder',id:'id:store-a',name:'Tienda A',path_lower:'/retail hub/portal/tienda a',path_display:'/Retail Hub/Portal/Tienda A'},{'.tag':'file',id:'id:pdf',name:'Prueba á.pdf',path_lower:'/retail hub/portal/tienda a/planogramas/prueba á.pdf',path_display:'/Retail Hub/Portal/Tienda A/Planogramas/Prueba á.pdf',size:9,rev:'rev-test',server_modified:'2026-10-24T00:00:00Z'}].filter(v=>!dropboxFileDeleted||v['.tag']!=='file'),has_more:false});
 if(u.pathname==='/2/files/upload_session/start')return reply({session_id:'upload-id'});
 if(u.pathname==='/2/files/upload_session/append_v2')return reply(null,200);
 if(u.pathname==='/2/files/upload_session/finish'){
 const path=JSON.parse(new Headers(init.headers).get('Dropbox-API-Arg')).commit.path;if(path.toLowerCase().includes('/cotizaciones/')){const meta={'.tag':'file',id:'id:quote-'+crypto.randomUUID(),rev:'a1b2c3d4e5f6',name:path.split('/').at(-1),path_lower:path.toLowerCase()};quoteFileMeta.set(path,meta);quoteFileMeta.set(meta.id,meta);const {['.tag']:tag,...concrete}=meta;return reply(concrete);}return reply({'.tag':'file',id:'id:pdf',name:path.split('/').at(-1),path_lower:path.toLowerCase(),path_display:path,size:9,rev:'rev-test',server_modified:'2026-10-24T00:00:00Z'});
 }
 if(u.pathname==='/2/files/download'){const range=new Headers(init.headers).get('range');return new Response('%PDF-test',{status:range?206:200,headers:range?{'content-range':'bytes 0-8/9'}:{}});}
 throw Error('Unexpected mock request: '+url);
};
const request=(path,{method='GET',token='valid',body,headers={}}={})=>handler(new Request('https://project.supabase.co/functions/v1/retailhub-api/'+path,{method,headers:{Origin:'https://grupobure.github.io',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}));
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('CORS preflight authorizes GitHub origin',async()=>{const r=await request('documents?store='+storeA,{method:'OPTIONS',token:null});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://grupobure.github.io');});
await check('retailhub domains receive their own CORS headers on preflight, success and errors',async()=>{
 for(const origin of ['https://retailhub.mx','https://www.retailhub.mx']){
  for(const [path,options,status] of [['status',{token:null},200],['documents',{method:'OPTIONS',token:null},204],['documents',{token:null},401]]){
   const r=await request(path,{...options,headers:{Origin:origin}});assert.equal(r.status,status);assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.ok(r.headers.get('vary').includes('Origin'));
  }
 }
});
await check('lookalike and insecure domains receive no CORS access',async()=>{
 for(const origin of ['https://retailhub.mx.evil.example','http://retailhub.mx','https://evilretailhub.mx','null']){
  const r=await request('status',{headers:{Origin:origin}});assert.equal(r.headers.get('access-control-allow-origin'),null);
  assert.equal((await request('status',{method:'OPTIONS',headers:{Origin:origin}})).status,403);
 }
});
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
await check('Dropbox returns to the exact approved domain that started authorization',async()=>{
 for(const origin of ['https://retailhub.mx','https://www.retailhub.mx']){
  const start=await request('dropbox/connect',{method:'POST',headers:{Origin:origin}});assert.equal(start.status,200);
  const state=new URL((await start.json()).url).searchParams.get('state');
  const result=await request('dropbox/callback?code=example&state='+encodeURIComponent(state),{token:null});
  assert.equal(result.status,302);assert.equal(result.headers.get('location'),origin+'/BibliotecaPlanog/?conexion=dropbox');
 }
 oauthExchanges=0;
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
 for(const store_id of [undefined,'bad','dddddddd-dddd-4ddd-8ddd-dddddddddddd'])assert.equal((await request('upload/start',{method:'POST',body:{filename:'test.pdf',category:'Planogramas',store_id}})).status,404);
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
await check('only admins can rename stores',async()=>{
 role='reader';assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'New name'}})).status,403);assert.equal((await request('stores/'+storeA,{method:'PATCH',token:null,body:{name:'New name'}})).status,401);role='admin';
});
await check('renaming a store updates Dropbox and catalog while keeping ID, permissions and file tickets',async()=>{
 role='reader';const ticket=await (await request('documents/'+id+'/link',{method:'POST'})).json();role='admin';const permissions=[...userStoreIds],at=calls.length;
 const r=await request('stores/'+storeA,{method:'PATCH',body:{name:'BK Martín Carrera Norte'}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.store.id,storeA);assert.equal(data.store.name,'BK Martín Carrera Norte');assert.equal(storeRows[0].path_lower,'/retail hub/portal/bk martín carrera norte');assert.deepEqual(userStoreIds,permissions);assert.ok(!calls.slice(at).some(v=>v.url.includes('/admin/users')||v.url.includes('/rh_documents')));
 role='reader';assert.equal((await request(ticket.url.split('retailhub-api/')[1],{token:null})).status,200);assert.equal((await request('documents?store='+storeA)).status,200);role='admin';assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'Tienda A'}})).status,200);
});
await check('rename rejects invalid names and existing destination folders without changing the store',async()=>{
 for(const name of ['', '../escape', 'Bad/Name', 'x'.repeat(101)])assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name}})).status,400);
 assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'Tienda B'}})).status,409);assert.equal(storeRows[0].name,'Tienda A');
});
await check('case-only rename uses an intermediate path and keeps the same folder and permissions',async()=>{
 const at=calls.length;const r=await request('stores/'+storeA,{method:'PATCH',body:{name:'TIENDA A'}});assert.equal(r.status,200);assert.equal((await r.json()).store.id,storeA);const moves=calls.slice(at).filter(v=>new URL(v.url).pathname==='/2/files/move_v2');assert.equal(moves.length,2);assert.ok(JSON.parse(moves[0].init.body).to_path.includes('/.rh-rename-'));assert.equal(storeRows[0].name,'TIENDA A');assert.ok(userStoreIds.includes(storeA));assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'Tienda A'}})).status,200);
});
await check('case-only rename restores the original folder name if the final move fails',async()=>{
 failNextMoveTo='/Retail Hub/Portal/TIENDA A';const r=await request('stores/'+storeA,{method:'PATCH',body:{name:'TIENDA A'}});assert.equal(r.status,409);assert.equal(folderOverrides.get('id:store-a').name,'Tienda A');assert.equal(storeRows[0].name,'Tienda A');
});
await check('saving an unchanged name avoids Dropbox moves and advertises both admin features',async()=>{
 const at=calls.length;assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'Tienda A'}})).status,200);assert.ok(!calls.slice(at).some(v=>new URL(v.url).pathname==='/2/files/move_v2'));const status=await (await request('status',{token:null})).json();assert.equal(status.features.editStores,true);assert.equal(status.features.deleteStores,true);
});
await check('store deletion requires admin authority and exact name confirmation',async()=>{
 role='reader';assert.equal((await request('stores/'+storeA,{method:'DELETE',body:{confirm_name:'Tienda A'}})).status,403);assert.equal((await request('stores/'+storeA,{method:'DELETE',token:null,body:{confirm_name:'Tienda A'}})).status,401);
 role='admin';const at=calls.length;assert.equal((await request('stores/'+storeA,{method:'DELETE',body:{confirm_name:'Wrong'}})).status,400);assert.ok(!calls.slice(at).some(v=>v.init.method==='PATCH'));assert.equal(storeRows[0].enabled,true);
});
await check('retiring a store blocks readers, administrators and existing file tickets while preserving Dropbox files',async()=>{
 const link=await (await request('documents/'+id+'/link',{method:'POST'})).json();assert.ok(link.url);const at=calls.length;
 const result=await request('stores/'+storeA,{method:'DELETE',body:{confirm_name:'Tienda A'}});assert.equal(result.status,200);assert.equal(storeRows[0].enabled,false);
 assert.ok(!calls.slice(at).some(v=>v.url.includes('dropboxapi.com')));assert.ok(!calls.slice(at).some(v=>v.url.includes('rh_documents')));
 for(const nextRole of ['reader','admin']){role=nextRole;assert.ok(!(await (await request('stores')).json()).stores.some(v=>v.id===storeA));assert.equal((await request('documents?store='+storeA)).status,404);assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);}
 assert.equal((await request('stores/'+storeA,{method:'PATCH',body:{name:'Revive'}})).status,404);
 assert.equal((await request('upload/start',{method:'POST',body:{filename:'test.pdf',category:'Planogramas',store_id:storeA}})).status,404);
 assert.equal((await request('users/'+otherId,{method:'PATCH',body:{store_ids:[storeA]}})).status,400);
});
await check('sync and create with the same folder cannot reactivate a retired store or restore former grants',async()=>{
 role='admin';assert.equal((await request('sync',{method:'POST',body:{}})).status,200);assert.equal(storeRows[0].enabled,false);
 assert.equal((await request('stores',{method:'POST',body:{name:'Tienda A'}})).status,409);assert.equal(storeRows[0].enabled,false);assert.ok(!(await (await request('stores')).json()).stores.some(v=>v.id===storeA));
 storeRows[0].enabled=true; // Reset the isolated mock fixture for subsequent compatibility checks.
});
await check('new stores automatically create exactly planogramas and listados with no reader grants',async()=>{
 const r=await request('stores',{method:'POST',body:{name:'Tienda con secciones'}});assert.equal(r.status,201);const store=(await r.json()).store;const prefix='/retail hub/portal/tienda con secciones/';const children=[...createdFolders.keys()].filter(v=>v.startsWith(prefix));assert.deepEqual(children.sort(),[prefix+'listados',prefix+'planogramas']);assert.ok(!userStoreIds.includes(store.id));
});
await check('sync prepares fixed folders for existing stores without duplicates',async()=>{
 const before=createdFolders.size;assert.equal((await request('sync',{method:'POST',body:{}})).status,200);assert.ok(createdFolders.has('/retail hub/portal/tienda a/planogramas'));assert.ok(createdFolders.has('/retail hub/portal/tienda a/listados'));assert.equal(createdFolders.size,before);
});
await check('catalog records accept only PDF in planogramas and native Excel in listados',async()=>{
 const base={id:'id:doc',size:8,rev:'rev',server_modified:'2026-10-24T00:00:00Z'};const make=(folder,name)=>({...base,name,path_lower:('/Retail Hub/Portal/Tienda A/'+folder+'/'+name).toLowerCase(),path_display:'/Retail Hub/Portal/Tienda A/'+folder+'/'+name});
 assert.equal((await apiModule.record(make('planogramas','Plano.PDF'))).category,'Planogramas');assert.equal((await apiModule.record(make('listados','Productos.XLSX'))).category,'Listados');assert.equal((await apiModule.record(make('listados','Productos.xls'))).category,'Listados');
 for(const [folder,name] of [['planogramas','wrong.xlsx'],['listados','wrong.pdf'],['otros','wrong.pdf'],['listados','wrong.csv'],['listados','wrong.exe']])assert.equal(await apiModule.record(make(folder,name)),null);
 assert.equal(await apiModule.record({...base,name:'root.pdf',path_lower:'/retail hub/portal/tienda a/root.pdf',path_display:'/Retail Hub/Portal/Tienda A/root.pdf'}),null);
});
await check('document listing filters legacy categories and mismatched file extensions',async()=>{
 const common={id,store_id:storeA,published:true};catalogOverride=[{...common,filename:'a.pdf',category:'Planogramas'},{...common,filename:'b.xlsx',category:'Listados'},{...common,filename:'c.xls',category:'Listados'},{...common,filename:'bad.xlsx',category:'Planogramas'},{...common,filename:'bad.pdf',category:'Listados'},{...common,filename:'bad.exe',category:'Listados'},{...common,filename:'old.pdf',category:'General'}];
 const d=await (await request('documents?store='+storeA)).json();assert.deepEqual(d.documents.map(v=>v.filename),['a.pdf','b.xlsx','c.xls']);catalogOverride=null;
});
await check('uploads reject files in the wrong section and unsupported extensions',async()=>{
 for(const [filename,category] of [['a.pdf','Listados'],['a.xlsx','Planogramas'],['a.xls','General'],['a.csv','Listados'],['a.xlsx','../listados']])assert.equal((await request('upload/start',{method:'POST',body:{filename,category,store_id:storeA}})).status,400);
});
async function uploadExcel(filename,bytes){
 const r=await request('upload/start',{method:'POST',body:{filename,category:'Listados',store_id:storeA}});assert.equal(r.status,200);const {ticket}=await r.json();const headers={'X-Upload-Ticket':ticket,'X-Upload-Offset':'0'};
 assert.equal((await request('upload/chunk',{method:'POST',headers,body:bytes})).status,200);assert.equal((await request('upload/finish',{method:'POST',headers:{...headers,'X-Upload-Offset':String(bytes.length)},body:''})).status,200);
 const row=JSON.parse(calls.at(-1).init.body);assert.equal(row.category,'Listados');assert.equal(row.store_id,storeA);assert.equal(row.filename,filename);
}
await check('XLSX uploads use listados and accept ZIP-format signatures',async()=>uploadExcel('Productos.xlsx',new Uint8Array([0x50,0x4b,0x03,0x04,1,2,3,4])));
await check('XLS uploads use listados and accept compound-document signatures',async()=>uploadExcel('Productos.xls',new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,1])));
await check('Excel uploads reject renamed PDF payloads',async()=>{
 for(const filename of ['bad.xlsx','bad.xls']){const start=await request('upload/start',{method:'POST',body:{filename,category:'Listados',store_id:storeA}});assert.equal(start.status,200);const {ticket}=await start.json();assert.equal((await request('upload/chunk',{method:'POST',headers:{'X-Upload-Ticket':ticket,'X-Upload-Offset':'0'},body:'%PDF-fake'})).status,400);}
});
await check('Excel downloads have their real MIME type and always use attachment disposition',async()=>{
 role='reader';for(const [filename,mime] of [['Productos.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['Productos.xls','application/vnd.ms-excel']]){currentFilename=filename;currentSection='Listados';const r=await request('documents/'+id+'/file');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),mime);assert.ok(r.headers.get('content-disposition').startsWith('attachment;'));}
 currentFilename='Prueba á.pdf';currentSection='Planogramas';role='admin';
});
await check('wrong-folder files cannot be accessed through old links',async()=>{
 for(const [name,section] of [['bad.xlsx','Planogramas'],['bad.pdf','Listados'],['bad.pdf','General']]){currentFilename=name;currentSection=section;assert.equal((await request('documents/'+id+'/file')).status,404);assert.equal((await request('documents/'+id+'/link',{method:'POST'})).status,404);}
 currentFilename='Prueba á.pdf';currentSection='Planogramas';
});
await check('Excel tickets obey store permission revocation',async()=>{
 role='reader';currentFilename='Productos.xlsx';currentSection='Listados';const link=await (await request('documents/'+id+'/link',{method:'POST'})).json();assert.ok(link.url);userStoreIds=[storeB];assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);userStoreIds=[storeA];currentFilename='Prueba á.pdf';currentSection='Planogramas';role='admin';
});
const deleteBody=()=>({confirm_filename:currentFilename});
const resetFileDeletion=()=>{documentDeleted=false;dropboxFileDeleted=false;deleteDropboxFailure=false;deleteDatabaseFailure=false;metadataFolder=false;liveFilename='';fileRevision='a1c10ce0dd78';fileStore='a';currentFilename='Prueba á.pdf';currentSection='Planogramas';role='admin';};
await check('only enabled administrators can delete documents',async()=>{
 role='reader';assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,403);assert.equal((await request('documents/'+id,{method:'DELETE',token:null,body:deleteBody()})).status,401);role='admin';disabled=true;assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,403);disabled=false;assert.equal(dropboxFileDeleted,false);
});
await check('document deletion requires confirmation of the current filename',async()=>{
 const at=calls.length;assert.equal((await request('documents/'+id,{method:'DELETE',body:{confirm_filename:'wrong.pdf'}})).status,409);liveFilename='Renamed.pdf';assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,409);liveFilename='';assert.ok(!calls.slice(at).some(v=>v.url.includes('files/delete_v2')||v.init.method==='DELETE'));
});
await check('folders, moved files, mismatched sections and unknown file revisions cannot be deleted',async()=>{
 const at=calls.length;metadataFolder=true;assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,404);metadataFolder=false;
 fileStore='b';assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,404);fileStore='a';
 currentFilename='wrong.xlsx';currentSection='Planogramas';assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,400);currentFilename='Prueba á.pdf';
 fileRevision='';assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,502);fileRevision='a1c10ce0dd78';assert.ok(!calls.slice(at).some(v=>v.url.includes('files/delete_v2')||v.init.method==='DELETE'));
});
await check('PDF deletion pins file ID and revision, removes catalog entry and invalidates previous tickets',async()=>{
 const link=await (await request('documents/'+id+'/link',{method:'POST'})).json();const folders=createdFolders.size;assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,200);assert.equal(documentDeleted,true);assert.equal(dropboxFileDeleted,true);assert.equal(createdFolders.size,folders);assert.deepEqual((await (await request('documents?store='+storeA)).json()).documents,[]);assert.equal((await request(link.url.split('retailhub-api/')[1],{token:null})).status,404);
 assert.equal((await request('sync',{method:'POST',body:{}})).status,200);assert.equal(documentDeleted,true);assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,200);resetFileDeletion();
});
await check('both XLSX and XLS can be deleted without removing their store or section folders',async()=>{
 for(const name of ['Listado.xlsx','Listado.xls']){currentFilename=name;currentSection='Listados';const folders=createdFolders.size,stores=storeRows.length;assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,200);assert.equal(documentDeleted,true);assert.equal(dropboxFileDeleted,true);assert.equal(createdFolders.size,folders);assert.equal(storeRows.length,stores);resetFileDeletion();}
});
await check('failed Dropbox deletion preserves the catalog entry',async()=>{
 deleteDropboxFailure=true;const r=await request('documents/'+id,{method:'DELETE',body:deleteBody()});assert.ok(r.status>=400);assert.equal(documentDeleted,false);assert.equal(dropboxFileDeleted,false);resetFileDeletion();
});
await check('retry after database cleanup failure does not delete Dropbox twice',async()=>{
 deleteDatabaseFailure=true;assert.ok((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status>=400);assert.equal(dropboxFileDeleted,true);assert.equal(documentDeleted,false);const deletes=calls.filter(v=>v.url.includes('files/delete_v2')).length;
 assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,200);assert.equal(documentDeleted,true);assert.equal(calls.filter(v=>v.url.includes('files/delete_v2')).length,deletes);resetFileDeletion();
});
await check('already missing Dropbox files can be removed from the catalog without touching other files',async()=>{
 dropboxFileDeleted=true;const at=calls.length;assert.equal((await request('documents/'+id,{method:'DELETE',body:deleteBody()})).status,200);assert.equal(documentDeleted,true);assert.ok(!calls.slice(at).some(v=>v.url.includes('files/delete_v2')));resetFileDeletion();
});
await check('delete capability is advertised for the admin interface',async()=>assert.equal((await (await request('status',{token:null})).json()).features.deleteDocuments,true));
// Dashboard permissions, validation, isolation and concurrent editing.
const taskId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',childId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const item=(changes={})=>({id:taskId,parent_id:null,title:'Crear PDF de planograma',status:'Pendiente',owner:'Víctor',due:'2026-11-01',notes:'Validar medidas',...changes});
const dashPath='stores/'+storeA+'/dashboard';
role='reader';disabled=false;userStoreIds=[storeA];storeRows.find(v=>v.id===storeA).enabled=true;
await check('dashboard requires authentication and the assigned store',async()=>{
 assert.equal((await request(dashPath,{token:null})).status,401);assert.equal((await request('stores/'+storeB+'/dashboard')).status,404);assert.equal((await request(dashPath)).status,200);
});
await check('readers cannot initialize or edit a dashboard',async()=>{
 for(const method of ['POST','PATCH'])assert.equal((await request(dashPath,{method,body:{revision:null,items:[item()]}})).status,403);assert.equal(dashboards.size,0);
});
role='admin';
await check('administrator initializes a store checklist without Dropbox calls',async()=>{
 const at=calls.length;const r=await request(dashPath,{method:'POST',body:{revision:null,items:[item()]}});assert.equal(r.status,201);const d=(await r.json()).dashboard;assert.equal(d.revision,1);assert.equal(d.items[0].title,item().title);assert.ok(!calls.slice(at).some(v=>v.url.includes('dropboxapi')));
});
await check('initialization retries never overwrite an existing checklist',async()=>{
 assert.equal((await request(dashPath,{method:'POST',body:{revision:null,items:[]}})).status,409);assert.equal(dashboards.get(storeA).items.length,1);
});
await check('all task fields save and other stores retain independent data',async()=>{
 assert.equal((await request('stores/'+storeB+'/dashboard',{method:'POST',body:{revision:null,items:[]}})).status,201);
 const task=item({title:'PDF final',status:'Bloqueado',owner:'Itzel',due:'2026-12-02',notes:'Falta aprobación'});
 const r=await request(dashPath,{method:'PATCH',body:{revision:1,items:[task]}});assert.equal(r.status,200);assert.deepEqual((await r.json()).dashboard.items,[task]);assert.equal(dashboards.get(storeB).items.length,0);
});
await check('stale revisions cannot overwrite another administrator changes',async()=>{
 assert.equal((await request(dashPath,{method:'PATCH',body:{revision:1,items:[]}})).status,409);assert.equal(dashboards.get(storeA).revision,2);assert.equal(dashboards.get(storeA).items[0].title,'PDF final');
});
await check('malformed structure, cycles, duplicates, invalid statuses and dates fail safely',async()=>{
 const invalid=[[item(),item()],[item({parent_id:childId})],[item({parent_id:childId}),item({id:childId,parent_id:taskId})],[item({status:'hack'})],[item({due:'2026-02-30'})],[item({title:' '})],[item({notes:'a'.repeat(2001)})]];
 for(const items of invalid)assert.equal((await request(dashPath,{method:'PATCH',body:{revision:2,items}})).status,400);assert.equal(dashboards.get(storeA).revision,2);
});
await check('dashboard size and hierarchy have bounded limits',async()=>{
 const many=Array.from({length:501},()=>item({id:crypto.randomUUID()}));assert.equal((await request(dashPath,{method:'PATCH',body:{revision:2,items:many}})).status,400);
 const deep=[];for(let i=0;i<7;i++)deep.push(item({id:crypto.randomUUID(),parent_id:i?deep[i-1].id:null}));assert.equal((await request(dashPath,{method:'PATCH',body:{revision:2,items:deep}})).status,400);
 const huge=JSON.stringify({items:'x'.repeat(270000)});assert.equal((await request(dashPath,{method:'PATCH',body:huge})).status,413);
});
await check('parent statuses reset while child fields are preserved',async()=>{
 const tasks=[item({status:'Terminado'}),item({id:childId,parent_id:taskId,status:'En revisión'})];const r=await request(dashPath,{method:'PATCH',body:{revision:2,items:tasks}});assert.equal(r.status,200);const d=(await r.json()).dashboard;assert.equal(d.items[0].status,'Pendiente');assert.equal(d.items[1].status,'En revisión');
});
await check('permission revocation and retired stores block dashboard reads and writes',async()=>{
 role='reader';userStoreIds=[];assert.equal((await request(dashPath)).status,404);userStoreIds=[storeA];storeRows.find(v=>v.id===storeA).enabled=false;assert.equal((await request(dashPath)).status,404);
 role='admin';assert.equal((await request(dashPath,{method:'PATCH',body:{revision:3,items:[]}})).status,404);storeRows.find(v=>v.id===storeA).enabled=true;
});
await check('dashboard capability is advertised',async()=>assert.equal((await (await request('status',{token:null})).json()).features.storeDashboard,true));
// Reusable snapshots: save a sanitized server-side copy and apply independently.
let savedTemplateId;
const sourceTasks=[item({status:'Terminado',owner:'Original',notes:'Privado',due:'2026-12-02'}),item({id:childId,parent_id:taskId,title:'Validar PDF',status:'No aplica',owner:'Responsable',notes:'Nota',due:'2026-11-02'})];
dashboards.set(storeA,{store_id:storeA,revision:10,items:structuredClone(sourceTasks),updated_at:'2026-10-24T00:00:00Z'});
role='reader';
await check('readers and disabled admins cannot list, save or apply templates',async()=>{
 for(const [path,method,body] of [['dashboard-templates','GET',undefined],['dashboard-templates','POST',{store_id:storeA,name:'Base',revision:10}],['dashboard-templates/'+taskId+'/apply','POST',{store_id:storeA,revision:null}]])assert.equal((await request(path,{method,body})).status,403);
 role='admin';disabled=true;assert.equal((await request('dashboard-templates')).status,403);disabled=false;
 assert.equal((await request('dashboard-templates',{token:null})).status,401);
});
await check('save reads the exact source revision and does not change the original board',async()=>{
 const original=structuredClone(dashboards.get(storeA));
 const response=await request('dashboard-templates',{method:'POST',body:{name:'Machote personalizado',store_id:storeA,revision:10,items:[]}});assert.equal(response.status,201);
 const result=(await response.json()).template;savedTemplateId=result.id;assert.equal(result.name,'Machote personalizado');assert.equal(result.item_count,2);assert.equal(result.items,undefined);assert.deepEqual(dashboards.get(storeA),original);
 const saved=dashboardTemplates.get(savedTemplateId);assert.deepEqual(saved.items.map(v=>v.title),sourceTasks.map(v=>v.title));assert.ok(saved.items.every(v=>v.status==='Pendiente'&&v.owner===''&&v.due===''&&v.notes===''));assert.notEqual(saved.items[0].id,taskId);assert.equal(saved.items[1].parent_id,saved.items[0].id);
});
await check('template names, missing boards, stale source revisions and retired source stores are rejected',async()=>{
 for(const name of ['', 'a'.repeat(101)])assert.equal((await request('dashboard-templates',{method:'POST',body:{store_id:storeA,name,revision:10}})).status,400);
 assert.equal((await request('dashboard-templates',{method:'POST',body:{store_id:storeA,name:'Old',revision:9}})).status,409);
 dashboards.delete(storeB);assert.equal((await request('dashboard-templates',{method:'POST',body:{store_id:storeB,name:'Missing',revision:1}})).status,404);
 storeRows.find(v=>v.id===storeA).enabled=false;assert.equal((await request('dashboard-templates',{method:'POST',body:{store_id:storeA,name:'Retired',revision:10}})).status,404);storeRows.find(v=>v.id===storeA).enabled=true;
 assert.equal(dashboardTemplates.size,1);
});
await check('template listing contains metadata only and validates pagination',async()=>{
 const d=await (await request('dashboard-templates')).json();assert.equal(d.templates[0].id,savedTemplateId);assert.equal(d.templates[0].items,undefined);assert.equal(d.next,null);assert.equal((await request('dashboard-templates?before=invalid')).status,400);
});
await check('applying initializes a new store from the saved snapshot with fresh IDs and pending tasks',async()=>{
 dashboards.get(storeA).items[0].title='Later source edit';
 const r=await request('dashboard-templates/'+savedTemplateId+'/apply',{method:'POST',body:{store_id:storeB,revision:null}});assert.equal(r.status,200);
 const board=(await r.json()).dashboard;assert.equal(board.revision,1);assert.equal(board.items[0].title,sourceTasks[0].title);assert.ok(board.items.every(v=>v.status==='Pendiente'&&!v.owner&&!v.due&&!v.notes));assert.notEqual(board.items[0].id,dashboardTemplates.get(savedTemplateId).items[0].id);assert.equal(board.items[1].parent_id,board.items[0].id);assert.equal(dashboards.get(storeA).revision,10);
});
await check('existing destination requires explicit confirmation and its current revision',async()=>{
 const path='dashboard-templates/'+savedTemplateId+'/apply',original=structuredClone(dashboards.get(storeB));
 assert.equal((await request(path,{method:'POST',body:{store_id:storeB,revision:1}})).status,400);
 assert.equal((await request(path,{method:'POST',body:{store_id:storeB,revision:2,confirm_replace:true}})).status,409);
 assert.equal((await request(path,{method:'POST',body:{store_id:storeB,revision:null}})).status,409);assert.deepEqual(dashboards.get(storeB),original);
 assert.equal((await request(path,{method:'POST',body:{store_id:storeB,revision:1,confirm_replace:true}})).status,200);assert.equal(dashboards.get(storeB).revision,2);assert.notEqual(dashboards.get(storeB).items[0].id,original.items[0].id);
 assert.equal(dashboardTemplates.get(savedTemplateId).items[0].title,sourceTasks[0].title);
});
await check('missing templates and retired destination stores cannot be applied',async()=>{
 assert.equal((await request('dashboard-templates/'+taskId+'/apply',{method:'POST',body:{store_id:storeB,revision:null}})).status,404);
 storeRows.find(v=>v.id===storeB).enabled=false;assert.equal((await request('dashboard-templates/'+savedTemplateId+'/apply',{method:'POST',body:{store_id:storeB,revision:2,confirm_replace:true}})).status,404);storeRows.find(v=>v.id===storeB).enabled=true;
 assert.equal((await (await request('status',{token:null})).json()).features.dashboardTemplates,true);
});
// Quotes: authoritative amounts, scoped access, publication, revisions and approvals.
const qr={id:crypto.randomUUID(),title:'Gráfico',material:'PVC 3 mm',width:'30',height:'40',quantity:2,unit:'cm',group:'Gráficos'};
const qOfferId=crypto.randomUUID();
const qOffer={id:qOfferId,supplier:'Proveedor prueba',lead_days:5,lead_basis:'Hábiles desde anticipo',terms:'Pago acordado',source:'prueba.xlsx',reported_subtotal:6000,tax_bp:1600,shipping:0,lines:[{id:crypto.randomUUID(),request_id:qr.id,description:'Gráfico PVC',material:qr.material,width:qr.width,height:qr.height,quantity:2,amount:6000,review:'confirmed',note:''}]};
const qdata={title:'Comparativo prueba',requests:[qr],offers:[qOffer],notes:''};let qid;
role='reader';quotePermission=false;userStoreIds=[storeA];
await check('readers cannot create quote boards or enable their own approval permission',async()=>{
 assert.equal((await request('quote-boards',{method:'POST',body:{store_id:storeA,data:qdata}})).status,403);assert.equal((await request('users/'+uid,{method:'PATCH',body:{quote_approval:true}})).status,403);
 assert.equal((await request('quote-boards?store='+storeB)).status,404);
});
role='admin';
await check('new quote boards start private drafts and retain integer cents',async()=>{
 const r=await request('quote-boards',{method:'POST',body:{store_id:storeA,data:qdata}});assert.equal(r.status,201);const d=(await r.json()).board;qid=d.id;assert.equal(d.published,false);assert.equal(d.revision,1);assert.equal(d.data.offers[0].lines[0].amount,6000);
});
await check('invalid money, duplicate mappings and fabricated concept IDs are rejected',async()=>{
 for(const change of [d=>{d.offers[0].lines[0].amount=1.111;},d=>{d.offers[0].lines[0].amount=-100;},d=>{d.offers[0].lines.push({...d.offers[0].lines[0],id:crypto.randomUUID()});},d=>{d.offers[0].lines[0].request_id=crypto.randomUUID();}]){const d=structuredClone(qdata);change(d);assert.equal((await request('quote-boards/'+qid,{method:'PATCH',body:{revision:1,data:d}})).status,400);}
});
await check('drafts are invisible to readers including direct URLs',async()=>{
 role='reader';quoteViewStores=[storeA];assert.equal((await request('quote-boards/'+qid)).status,404);assert.equal((await (await request('quote-boards?store='+storeA)).json()).boards.length,0);role='admin';
});
await check('publication requires admin and the exact compared revision',async()=>{
 assert.equal((await request('quote-boards/'+qid+'/publish',{method:'POST',body:{revision:0}})).status,409);assert.equal((await request('quote-boards/'+qid+'/publish',{method:'POST',body:{revision:1}})).status,200);
 role='reader';assert.equal((await request('quote-boards/'+qid)).status,200);assert.equal((await request('quote-boards/'+qid+'/publish',{method:'POST',body:{revision:1}})).status,403);
});
await check('approval requires a fresh explicit permission, store grant and confirmation',async()=>{
 const path='quote-boards/'+qid+'/approve',body={revision:1,offer_id:qOfferId,confirm:true};
 assert.equal((await request(path,{method:'POST',body})).status,403);quotePermission=true;assert.equal((await request(path,{method:'POST',body})).status,403);quoteApproveStores=[storeA];quoteViewStores=[];assert.equal((await request(path,{method:'POST',body})).status,404);quoteViewStores=[storeA];
 assert.equal((await request(path,{method:'POST',body:{...body,confirm:false}})).status,400);assert.equal((await request(path,{method:'POST',body:{...body,revision:0}})).status,409);
 assert.equal((await request(path,{method:'POST',body})).status,200);assert.equal(quoteApprovals.length,1);assert.equal(quoteApprovals[0].approved_name,'victor');
 assert.equal((await request(path,{method:'POST',body})).status,409);role='admin';
});
await check('edits create a new unpublished revision and preserve old approvals',async()=>{
 const changed=structuredClone(qdata);changed.offers[0].lines[0].amount=9000;changed.offers[0].reported_subtotal=9000;
 assert.equal((await request('quote-boards/'+qid,{method:'PATCH',body:{revision:1,data:changed}})).status,200);assert.equal(quoteBoards.get(qid).revision,2);assert.equal(quoteBoards.get(qid).published,false);assert.equal(quoteApprovals[0].snapshot.offers[0].lines[0].amount,6000);
 assert.equal((await request('quote-boards/'+qid,{method:'PATCH',body:{revision:1,data:qdata}})).status,409);
});
await check('unknown delivery, shipping, mismatched subtotal and unresolved differences block approvals',async()=>{
 const board=quoteBoards.get(qid);board.published=true;
 for(const change of [o=>{o.lead_days=null;},o=>{o.shipping=null;},o=>{o.reported_subtotal=50;},o=>{o.lines[0].review='clarify';},o=>{o.lines[0].quantity=1.5;}]){board.data=structuredClone(qdata);change(board.data.offers[0]);assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body:{revision:2,offer_id:qOfferId,confirm:true}})).status,400);}
});
await check('partial coverage is never counted as zero and requires explicit acceptance',async()=>{
 const board=quoteBoards.get(qid);board.data=structuredClone(qdata);board.data.requests.push({...qr,id:crypto.randomUUID(),title:'Lona pendiente'});
 const t=apiModule.qTotals(board.data,board.data.offers[0]);assert.equal(t.missing.length,1);assert.equal(t.total,6960);
 const body={revision:2,offer_id:qOfferId,confirm:true};assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body})).status,400);assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body:{...body,confirm_partial:true}})).status,200);
});
await check('retiring stores and revoking approver permission take effect immediately',async()=>{
 role='reader';quotePermission=false;quoteApproveStores=[];assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body:{}})).status,403);storeRows.find(v=>v.id===storeA).enabled=false;assert.equal((await request('quote-boards/'+qid)).status,404);storeRows.find(v=>v.id===storeA).enabled=true;role='admin';
});
await check('admin can assign approval without changing other trusted metadata',async()=>{
 const r=await request('users/'+uid,{method:'PATCH',body:{quote_view_store_ids:[storeA],quote_approve_store_ids:[storeA]}});assert.equal(r.status,200);const last=calls.filter(v=>v.url.endsWith('/auth/v1/admin/users/'+uid)&&v.init.method==='PUT').at(-1);assert.deepEqual(JSON.parse(last.init.body).app_metadata.quote_approve_store_ids,[storeA]);assert.equal(JSON.parse(last.init.body).app_metadata.quote_approval,false);
 assert.equal((await (await request('status',{token:null})).json()).features.quotes,true);
});
let backupTicket,backupId,backupUrl;
await check('quote backups require admin and reject invalid names, file types and sizes',async()=>{
 role='reader';assert.equal((await request('quote-files/start',{method:'POST',body:{board_id:qid,filename:'a.pdf',size:5}})).status,403);role='admin';
 for(const [filename,size]of [['../a.pdf',5],['a.html',5],['a.pdf',20000001],['a.pdf',0]])assert.equal((await request('quote-files/start',{method:'POST',body:{board_id:qid,filename,size}})).status,400);
});
await check('quote backups stream in chunks and recover catalog writes without uploading twice',async()=>{
 const r=await request('quote-files/start',{method:'POST',body:{board_id:qid,filename:'Respaldo prueba.pdf',size:5}});assert.equal(r.status,200);backupTicket=(await r.json()).ticket;
 const headers={'X-Upload-Ticket':backupTicket,'X-Upload-Offset':'0'};assert.equal((await request('quote-files/chunk',{method:'POST',headers,body:new Uint8Array([37,80,68,70,45])})).status,200);
 quoteFileDbFailure=true;const finish={method:'POST',headers:{...headers,'X-Upload-Offset':'5'},body:new Uint8Array()};assert.ok((await request('quote-files/finish',finish)).status>=400);const uploads=calls.filter(v=>v.url.includes('upload_session/finish')).length;
 assert.equal((await request('quote-files/finish',finish)).status,200);assert.equal(calls.filter(v=>v.url.includes('upload_session/finish')).length,uploads);backupId=[...quoteFileRows.keys()][0];assert.ok(backupId);
});
await check('quote backup links are scoped and expire or revoke with store access',async()=>{
 role='reader';userStoreIds=[storeA];const r=await request('quote-files/'+backupId+'/link',{method:'POST'});assert.equal(r.status,200);backupUrl=(await r.json()).url;let response=await handler(new Request(backupUrl));assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(response.headers.get('content-type'),'application/octet-stream');
 quoteViewStores=[];assert.equal((await handler(new Request(backupUrl))).status,404);quoteViewStores=[storeA];disabled=true;assert.equal((await handler(new Request(backupUrl))).status,403);disabled=false;role='admin';
});
await check('quote backups revalidate board publication and actual Dropbox folder',async()=>{
 role='reader';quoteBoards.get(qid).published=false;assert.equal((await handler(new Request(backupUrl))).status,404);quoteBoards.get(qid).published=true;
 const row=quoteFileRows.get(backupId),meta=quoteFileMeta.get(row.dropbox_id),path=meta.path_lower;meta.path_lower='/another-store/cotizaciones/test.pdf';assert.equal((await handler(new Request(backupUrl))).status,404);meta.path_lower=path;role='admin';
});
await check('historical quote approvals expose the approved data rather than later edits',async()=>{
 const a=quoteApprovals[0];const d=await (await request('quote-boards/'+qid+'/approvals/'+a.id)).json();assert.equal(d.approval.snapshot.data.offers[0].lines[0].amount,6000);
 assert.equal((await request('quote-boards/'+qid+'/approvals/'+crypto.randomUUID())).status,404);
});
// Independent quote visibility and approval, per store, default deny.
await check('document access and the retired global approval flag do not grant quote visibility',async()=>{
 role='reader';userStoreIds=[storeA,storeB];quoteViewStores=[];quoteApproveStores=[];quotePermission=true;
 assert.equal((await request('quote-boards?store='+storeA)).status,404);assert.equal((await request('quote-boards/'+qid)).status,404);
 assert.deepEqual((await (await request('stores?scope=quotes')).json()).stores,[]);
 assert.equal((await request('documents?store='+storeA)).status,200);
});
await check('quote visibility can be granted without document or dashboard access',async()=>{
 userStoreIds=[];quoteViewStores=[storeA];quoteApproveStores=[];
 const d=await (await request('stores?scope=quotes')).json();assert.deepEqual(d.stores.map(s=>s.id),[storeA]);
 assert.equal((await request('quote-boards/'+qid)).status,200);assert.equal((await request('documents?store='+storeA)).status,404);assert.equal((await request('stores/'+storeA+'/dashboard')).status,404);
 assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body:{}})).status,403);
});
await check('view and approve grants are independent across stores and cannot be forged in editable metadata',async()=>{
 quoteViewStores=[storeA,storeB];quoteApproveStores=[storeB];
 assert.equal((await request('quote-boards/'+qid+'/approve',{method:'POST',body:{}})).status,403);
 quoteViewStores=[storeB];assert.equal((await request('quote-boards/'+qid)).status,404);
 assert.equal((await request('quote-files/'+backupId+'/link',{method:'POST'})).status,404);
});
await check('only admins can assign valid store grants; approval must be a subset of visibility',async()=>{
 role='reader';assert.equal((await request('users/'+uid,{method:'PATCH',body:{quote_view_store_ids:[storeA],quote_approve_store_ids:[storeA]}})).status,403);role='admin';
 assert.equal((await request('users/'+uid,{method:'PATCH',body:{quote_view_store_ids:[],quote_approve_store_ids:[storeA]}})).status,400);
 assert.equal((await request('users/'+uid,{method:'PATCH',body:{quote_view_store_ids:['invalid'],quote_approve_store_ids:[]}})).status,400);
 assert.equal((await request('users/'+uid,{method:'PATCH',body:{quote_approval:true}})).status,400);
 const r=await request('users/'+uid,{method:'PATCH',body:{quote_view_store_ids:[storeA],quote_approve_store_ids:[]}});assert.equal(r.status,200);const d=await r.json();assert.deepEqual(d.user.quote_view_store_ids,[storeA]);assert.deepEqual(d.user.quote_approve_store_ids,[]);
});
await check('new readers receive no quote grants unless explicitly selected and revocation blocks old file tickets',async()=>{
 const r=await request('users',{method:'POST',body:{username:'nuevoquotes',name:'Nuevo',password:'password-123456',store_ids:[storeA]}});assert.equal(r.status,201);const d=await r.json();assert.deepEqual(d.user.quote_view_store_ids,[]);assert.deepEqual(d.user.quote_approve_store_ids,[]);
 role='reader';quoteViewStores=[];quoteApproveStores=[];assert.equal((await handler(new Request(backupUrl))).status,404);role='admin';userStoreIds=[storeA];
 assert.equal((await (await request('status',{token:null})).json()).features.quotePermissions,true);
});
await check('an explicitly assigned quote approver can approve without access to store documents',async()=>{
 role='admin';const created=await request('quote-boards',{method:'POST',body:{store_id:storeA,data:qdata}});const fresh=(await created.json()).board;assert.equal((await request('quote-boards/'+fresh.id+'/publish',{method:'POST',body:{revision:1}})).status,200);
 role='reader';userStoreIds=[];quoteViewStores=[storeA];quoteApproveStores=[storeA];
 assert.equal((await request('quote-boards/'+fresh.id+'/approve',{method:'POST',body:{revision:1,offer_id:qOfferId,confirm:true}})).status,200);
 assert.equal((await request('documents?store='+storeA)).status,404);role='admin';userStoreIds=[storeA];
});
// Reusable request-only templates and deletion preserve financial history.
let savedQuoteTemplate;
await check('quote templates are administrator-only, including direct details, edits and removal',async()=>{
 role='reader';for(const [path,method,body] of [['quote-templates','GET'],['quote-templates','POST',{name:'Base',requests:[qr]}],['quote-templates/'+qr.id,'GET'],['quote-templates/'+qr.id,'PATCH',{}],['quote-templates/'+qr.id,'DELETE',{}]])assert.equal((await request(path,{method,body})).status,403);role='admin';
});
await check('saving a quote template strips vendor prices and notes and assigns independent concept IDs',async()=>{
 const before=structuredClone(quoteBoards.get(qid));const r=await request('quote-templates',{method:'POST',body:{name:'Machote gráficos',requests:qdata.requests,offers:qdata.offers,notes:'Do not copy'}});assert.equal(r.status,201);savedQuoteTemplate=(await r.json()).template;assert.equal(savedQuoteTemplate.request_count,1);assert.equal(savedQuoteTemplate.requests,undefined);const t=quoteTemplates.get(savedQuoteTemplate.id);assert.notEqual(t.requests[0].id,qr.id);assert.equal(t.offers,undefined);assert.equal(t.notes,undefined);assert.deepEqual(quoteBoards.get(qid),before);
});
await check('quote template listing hides concept contents and detail remains available for copying',async()=>{
 const d=await (await request('quote-templates')).json();assert.equal(d.templates[0].requests,undefined);const t=(await (await request('quote-templates/'+savedQuoteTemplate.id)).json()).template;assert.equal(t.requests[0].title,qr.title);assert.equal((await request('quote-templates?before=invalid')).status,400);
});
await check('invalid or empty quote templates are rejected',async()=>{
 for(const body of [{name:'',requests:[qr]},{name:'A',requests:[]},{name:'B',requests:[{...qr,quantity:0}]},{name:'X'.repeat(101),requests:[qr]}])assert.equal((await request('quote-templates',{method:'POST',body})).status,400);
});
await check('updating a quote template requires confirmation and an exact revision',async()=>{
 const path='quote-templates/'+savedQuoteTemplate.id;assert.equal((await request(path,{method:'PATCH',body:{name:'Updated',requests:[qr],revision:1}})).status,400);assert.equal((await request(path,{method:'PATCH',body:{name:'Updated',requests:[qr],revision:1,confirm_replace:true}})).status,200);assert.equal((await request(path,{method:'PATCH',body:{name:'Stale',requests:[qr],revision:1,confirm_replace:true}})).status,409);
});
await check('quote template removal requires confirmation, retains its record and never changes existing boards',async()=>{
 const before=structuredClone(quoteBoards.get(qid)),path='quote-templates/'+savedQuoteTemplate.id;assert.equal((await request(path,{method:'DELETE',body:{confirm_name:'wrong',revision:2}})).status,409);assert.equal((await request(path,{method:'DELETE',body:{confirm_name:'Updated',revision:2}})).status,200);assert.equal((await request(path)).status,404);assert.ok(quoteTemplates.get(savedQuoteTemplate.id).deleted_at);assert.deepEqual(quoteBoards.get(qid),before);
});
let removable;
await check('removing a quote requires administrator role, matching title and exact revision',async()=>{
 removable=(await (await request('quote-boards',{method:'POST',body:{store_id:storeA,data:qdata}})).json()).board;const path='quote-boards/'+removable.id;role='reader';assert.equal((await request(path,{method:'DELETE',body:{}})).status,404);role='admin';assert.equal((await request(path,{method:'DELETE',body:{confirm_title:'wrong',revision:1}})).status,400);assert.equal((await request(path,{method:'DELETE',body:{confirm_title:removable.title,revision:0}})).status,409);
});
await check('retiring an unapproved quote hides details, lists and backups without deleting Dropbox content',async()=>{
 const file=crypto.randomUUID();quoteFileRows.set(file,{id:file,board_id:removable.id,dropbox_id:'no-access',revision:'r',filename:'original.pdf'});const before=calls.length;assert.equal((await request('quote-boards/'+removable.id,{method:'DELETE',body:{confirm_title:removable.title,revision:1}})).status,200);assert.ok(quoteBoards.get(removable.id).deleted_at);assert.equal((await request('quote-boards/'+removable.id)).status,404);assert.equal((await request('quote-files/'+file+'/link',{method:'POST'})).status,404);const list=(await (await request('quote-boards?store='+storeA)).json()).boards;assert.ok(!list.some(b=>b.id===removable.id));assert.ok(!calls.slice(before).some(c=>c.url.includes('files/delete')));
});
await check('an approved quote cannot be removed even after editing a newer draft',async()=>{
 const b=quoteBoards.get(qid);assert.ok(quoteApprovals.some(a=>a.board_id===qid));assert.equal((await request('quote-boards/'+qid,{method:'DELETE',body:{confirm_title:b.title,revision:b.revision}})).status,409);assert.ok(!quoteBoards.get(qid).deleted_at);assert.equal((await (await request('status',{token:null})).json()).features.quoteTools,true);
});
const migration=readFileSync(new URL('../database/007-machotes-cotizaciones.sql',import.meta.url),'utf8');assert.ok(migration.includes('b.deleted_at is not null or not b.published'));assert.ok(migration.includes('where id=p_board for update'));assert.ok(migration.includes('quote_has_approvals'));assert.ok(migration.includes('enable row level security'));
await check('new injected Supabase API keys are supported',async()=>{delete environment.SUPABASE_ANON_KEY;delete environment.SUPABASE_SERVICE_ROLE_KEY;environment.SUPABASE_PUBLISHABLE_KEYS=JSON.stringify({default:'sb_publishable_example'});environment.SUPABASE_SECRET_KEYS=JSON.stringify({default:'sb_secret_example'});await request('documents?store='+storeA);const h=new Headers(calls.at(-1).init.headers);assert.equal(h.get('apikey'),'sb_secret_example');assert.equal(h.get('authorization'),null);});
console.log(`${checks} security and integration checks passed (mocked services).`);
