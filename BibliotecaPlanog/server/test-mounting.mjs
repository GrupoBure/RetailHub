import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const ts=createRequire(new URL('../source/package.json',import.meta.url))('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8'),uri=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const model=read('../source/src/mounting-model.ts'),m=await import(uri(model));const sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',uid='11111111-1111-4111-8111-111111111111';
const asset='22222222-2222-4222-8222-222222222222.png';
let role='admin',grants=[],enabled=true,active=true,handler,version=0;const files=new Map(),folders=new Set(['/Retail Hub/Portal/Demo']),root='/Retail Hub/Portal/Demo/montaje';
const meta=(path,bytes)=>({'.tag':'file',name:path.split('/').at(-1),path_lower:path.toLowerCase(),path_display:path,id:path,rev:'rev'+(++version),size:bytes.length,server_modified:'2026-11-01T00:00:00Z'});
const reply=(d,status=200)=>new Response(JSON.stringify(d),{status});
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://demo.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',DROPBOX_APP_KEY:'key',DROPBOX_APP_SECRET:'secret',DROPBOX_REFRESH_TOKEN:'refresh'})[k]},serve:fn=>handler=fn};
const server=read('./retailhub-api.ts');assert.ok(server.includes(model.trim()));await import(uri(server));
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url),b=typeof init.body==='string'?JSON.parse(init.body):null;
 if(u.pathname==='/auth/v1/user')return reply({id:uid,app_metadata:{rh_portal:true,role,disabled:!enabled,store_ids:grants,exhibit_store_ids:[]}});
 if(u.pathname==='/rest/v1/rh_stores')return reply(active?[{id:sid,name:'Demo',enabled:true,dropbox_id:'/Retail Hub/Portal/Demo'}]:[]);
 if(u.hostname==='www.truper.com')return new Response('<span>Código: <strong>12345</strong></span><span>Clave: <strong>TEST</strong></span><h1>Artículo exacto</h1><table id="espec"><tr><td>Alto</td><td>3 cm</td></tr></table>',{headers:{'Content-Type':'text/html'}});
 if(u.pathname==='/oauth2/token')return reply({access_token:'dropbox',expires_in:3600});
 if(u.hostname==='api.dropboxapi.com'){
  if(u.pathname.endsWith('/files/get_metadata')){if(folders.has(b.path))return reply({'.tag':'folder',path_display:b.path,path_lower:b.path.toLowerCase(),name:b.path.split('/').at(-1)});if(files.has(b.path))return reply(files.get(b.path).meta);return reply({error_summary:'path/not_found/'},409);}
  if(u.pathname.endsWith('/files/create_folder_v2')){if(folders.has(b.path))return reply({error_summary:'path/conflict/'},409);folders.add(b.path);return reply({metadata:{'.tag':'folder',path_display:b.path}});}
  if(u.pathname.endsWith('/files/list_folder')){if(!folders.has(b.path))return reply({error_summary:'path/not_found/'},409);return reply({entries:[...files].filter(([p])=>p.startsWith(b.path+'/')&&!p.slice(b.path.length+1).includes('/')).map(([,v])=>v.meta),has_more:false});}
  if(u.pathname.endsWith('/files/delete_v2')){const f=files.get(b.path);if(!f||f.meta.rev!==b.parent_rev)return reply({error_summary:'path/conflict/'},409);files.delete(b.path);return reply({metadata:f.meta});}
 }
 if(u.hostname==='content.dropboxapi.com'){
  const args=JSON.parse(init.headers['Dropbox-API-Arg']);
  if(u.pathname.endsWith('/files/download')){const f=files.get(args.path);assert.ok(f,'Missing mock file '+args.path);return new Response(f.bytes);}
  if(u.pathname.endsWith('/files/upload')){const old=files.get(args.path);if(typeof args.mode==='object'?(old?.meta.rev!==args.mode.update):!!old)return reply({error_summary:'path/conflict/'},409);const bytes=new Uint8Array(init.body),info=meta(args.path,bytes);files.set(args.path,{bytes,meta:info});return reply(info);}
 }
 throw Error('Unexpected route '+u.pathname);
};
const data={name:'Montaje de prueba',image:asset,original:'',zones:[{id:'zone-1',number:'1',family:'Lijas',x:.1,y:.2,w:.1,h:.2,stage:0,note:''}]};
assert.equal(m.validateMount(data).zones[0].stage,0);
for(const bad of [{stage:4},{stage:-1},{x:-.1},{y:NaN},{w:0},{x:.9,w:.2},{number:''}])assert.throws(()=>m.validateMount({...data,zones:[{...data.zones[0],...bad}]}));
assert.throws(()=>m.validateMount({...data,zones:[...data.zones,...data.zones]}));assert.throws(()=>m.validateMount({...data,image:'../secret.png'}));
assert.equal(m.mountStage(true,3,0),3);assert.equal(m.mountStage(false,2,3),1);assert.equal(m.mountStage(false,1,3),0);
const request=(path='',method='GET',body)=>handler(new Request('https://demo.supabase.co/functions/v1/retailhub-api/mounting'+path+'?store='+sid,{method,headers:{authorization:'Bearer test',origin:'https://retailhub.mx','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));
const image=new Uint8Array([137,80,78,71,13,10,26,10]);files.set(root+'/archivos/'+asset,{bytes:image,meta:meta(root+'/archivos/'+asset,image)});
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
let saved;
await check('empty listing does not create folders',async()=>{const before=folders.size;assert.deepEqual(await (await request()).json(),{plans:[]});assert.equal(folders.size,before);});
await check('admin creates a plan; invalid geometry rejected',async()=>{assert.equal((await request('','POST',{data:{...data,zones:[{...data.zones[0],w:2}]}})).status,400);const r=await request('','POST',{data});assert.equal(r.status,201);saved=(await r.json()).record;assert.equal((await (await request()).json()).plans[0].total,1);});
await check('unassigned or disabled readers cannot read plans or images',async()=>{role='reader';grants=[];for(const p of ['', '/'+saved.id,'/'+saved.id+'/image'])assert.equal((await request(p)).status,404);grants=[sid];enabled=false;assert.equal((await request('/'+saved.id)).status,403);enabled=true;});
await check('assigned readers view but cannot mutate plans or upload',async()=>{assert.equal((await request('/'+saved.id)).status,200);assert.match((await (await request('/'+saved.id+'/image')).json()).dataUrl,/^data:image\/png/);for(const [p,method] of [['','POST'],['/'+saved.id,'PATCH'],['/'+saved.id,'DELETE'],['/assets','POST']])assert.equal((await request(p,method,{data,revision:saved.revision,confirm_name:data.name})).status,403);role='admin';});
await check('stages save and stale revisions cannot overwrite or delete',async()=>{const old=saved.revision;const r=await request('/'+saved.id,'PATCH',{revision:old,data:{...data,zones:[{...data.zones[0],stage:3}]}});assert.equal(r.status,200);saved=(await r.json()).record;assert.equal(saved.data.zones[0].stage,3);assert.equal((await (await request()).json()).plans[0].complete,1);assert.equal((await request('/'+saved.id,'PATCH',{revision:old,data})).status,409);assert.equal((await request('/'+saved.id,'DELETE',{revision:old,confirm_name:data.name})).status,409);});
await check('removing a plan requires confirmation and preserves source assets',async()=>{assert.equal((await request('/'+saved.id,'DELETE',{revision:saved.revision,confirm_name:'wrong'})).status,400);assert.equal((await request('/'+saved.id,'DELETE',{revision:saved.revision,confirm_name:data.name})).status,200);assert.ok(files.has(root+'/archivos/'+asset));assert.equal((await request('/'+saved.id)).status,404);});
console.log('Mounting model and '+checks+' API scenarios passed.');
