const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../server/retailhub-api.ts'),'utf8');
const code=ts.transpileModule(source+`\nexport const testRefresh=refreshStoreDocuments;export function configureTest(m:any){dbx=m.dbx;supa=m.supa;setting=m.setting;liveFolder=m.liveFolder;record=m.record;requireUser=m.requireUser||requireUser;requireStore=m.requireStore||requireStore;documentRecord=m.documentRecord||documentRecord;content=m.content||content;seal=m.seal||seal;unseal=m.unseal||unseal;} `,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={exports:{},Deno:{env:{get:k=>k==='RH_DROPBOX_ROOT'?'/Retail Hub/Portal':undefined},serve:()=>{}},Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortSignal,crypto:require('node:crypto').webcrypto,console,setTimeout,clearTimeout};vm.createContext(env);vm.runInContext(code,env);const api=env.exports;
const store={id:'11111111-1111-4111-8111-111111111111',dropbox_id:'id:store'},folder={id:'id:store',path_lower:'/retail hub/portal/test',path_display:'/Retail Hub/Portal/Test'};
const file=(id,rev,name=id+'.pdf')=>({'.tag':'file',id,rev,name,path_lower:folder.path_lower+'/'+(name.endsWith('.xlsx')?'listados':'planogramas')+'/'+name});
function setup(before,pages){const calls=[],settings=new Map();let page=0;const m={setting:async(k,v)=>{if(v!==undefined)settings.set(k,v);return settings.get(k);},liveFolder:async()=>folder,dbx:async(route,args)=>{calls.push({route,args});if(route.startsWith('files/list_folder')){const p=pages[page++];if(p instanceof Error)throw p;return p;}return file('id:base','r1','Base recepción.xlsx');},record:async f=>({dropbox_id:f.id,revision:f.rev,filename:f.name,store_id:store.id}),supa:async(p,init={})=>{calls.push({p,...init});if(!init.method)return before;return[];}};api.configureTest(m);return{calls,settings,m};}
(async()=>{
 // Edited + newly added + deleted; complete pagination before removing anything.
 const before=[{id:'a',dropbox_id:'id:a',filename:'a.pdf',revision:'r1'},{id:'b',dropbox_id:'id:b',filename:'b.pdf',revision:'r1'}];
 let t=setup(before,[{entries:[file('id:a','r2','a.pdf')],has_more:true,cursor:'next'},{entries:[file('id:c','r1','c.pdf')],has_more:false}]);await api.testRefresh(store);
 const writes=t.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].body).map(x=>x.dropbox_id),['id:a','id:c']);const deletes=t.calls.filter(c=>c.method==='DELETE');assert.equal(deletes.length,1);assert.match(deletes[0].p,/id=in\.\(b\)/);assert(!deletes[0].p.includes('(a)'));
 assert(!writes[0].body.includes('published'),'Preserve existing publication permissions');
 const count=t.calls.length;await api.testRefresh(store);assert.equal(t.calls.length,count,'Throttle repeated requests for same store');
 // Incomplete Dropbox listing must leave database untouched.
 t=setup(before,[{entries:[file('id:a','r2','a.pdf')],has_more:true,cursor:'next'},new Error('network')]);await assert.rejects(()=>api.testRefresh(store),/network/);assert.equal(t.calls.filter(c=>c.method==='POST'||c.method==='DELETE').length,0);
 // Coalesce simultaneous watchers, and unchanged revisions do not rewrite rows.
 t=setup([before[0]],[{entries:[file('id:a','r1','a.pdf')],has_more:false}]);await Promise.all([api.testRefresh(store),api.testRefresh(store)]);assert.equal(t.calls.filter(c=>c.route?.startsWith('files/list_folder')).length,1);assert.equal(t.calls.filter(c=>c.method==='POST'||c.method==='DELETE').length,0);
 // Replacement refuses an outdated revision before opening a Dropbox upload session.
 t=setup([],[]);let uploaded=false,sealed;
 const filename='Base recepción.xlsx';Object.assign(t.m,{requireUser:async()=>({id:'admin',app_metadata:{role:'admin'}}),requireStore:async()=>store,documentRecord:async()=>({store_id:store.id,filename,dropbox_id:'id:base'}),dbx:async(route)=>route==='files/get_metadata'?file('id:base','r2',filename):{},content:async()=>{uploaded=true;return new Response(JSON.stringify({session_id:'session'}));},seal:async(_,v)=>{sealed=v;return'ticket';}});api.configureTest(t.m);
 const request=revision=>new Request('https://example.test/functions/v1/retailhub-api/upload/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename,category:'Listados',store_id:store.id,replace_document:'22222222-2222-4222-8222-222222222222',replace_revision:revision})});
 let response=await api.handle(request('r1'));assert.equal(response.status,409);assert.equal(uploaded,false);
 response=await api.handle(request('r2'));assert.equal(response.status,200);assert.equal(sealed.replaceRevision,'r2');assert.equal(sealed.replaceId,'id:base');
 console.log('PASS: additions, revisions, deletions, pagination, unchanged permissions, failed scans, throttling, coalescing and replacement conflicts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
