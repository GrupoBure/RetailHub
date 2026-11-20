import {useEffect,useState,useRef} from 'react';
import type {FormEvent} from 'react';
import './provider-pending.css';

const sections={delivery:'Pendientes de entrega',improvements:'Áreas de mejora',designs:'Diseños para proveedor'} as const;
type Section=keyof typeof sections;
type Provider={id:string;name:string;sections:{section:Section;can_edit:boolean}[]};
type Draft={title:string;description:string;location:string;suggestion:string;solution:string;photo:string|null};
type Item=Draft&{id:string;updated_at:string;completed_at:string|null;completed_by:string|null};
type User={id:string;name:string;username:string;enabled:boolean;role:string};
type Grant={user_id:string;section:Section;can_edit:boolean};
type Request=(path:string,init?:RequestInit)=>Promise<any>;
const empty:Draft={title:'',description:'',location:'',suggestion:'',solution:'',photo:null};
const fields=[['title','Título',120],['location','Proyecto o ubicación',160],['description','Descripción',3000],['suggestion','Sugerencia',3000],['solution','Solución',3000]] as const;

async function photoData(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecciona una foto JPG, PNG o WebP.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');
  if(!context)throw Error('No se pudo preparar la foto.');
  context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const jpeg=canvas.toDataURL('image/jpeg',0.8);
  if(jpeg.length>800000)throw Error('La foto sigue siendo demasiado pesada.');
  return jpeg;
 }finally{bitmap.close();}
}

export default function ProviderPending({api,admin}:{api:Request;admin:boolean}){
 const ref=useRef(api);ref.current=api;
 const [providers,setProviders]=useState<Provider[]>([]),[providerId,setProviderId]=useState('');
 const [section,setSection]=useState<Section>('improvements'),[completed,setCompleted]=useState(false);
 const [items,setItems]=useState<Item[]>([]),[reload,setReload]=useState(0),[loading,setLoading]=useState(true);
 const [draft,setDraft]=useState<(Draft&Partial<Item>)|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [showPermissions,setShowPermissions]=useState(false),[people,setPeople]=useState<User[]>([]),[grants,setGrants]=useState<Grant[]>([]);
 const [person,setPerson]=useState(''),[newProvider,setNewProvider]=useState<string|null>(null);
 const provider=providers.find(p=>p.id===providerId);
 const canEdit=!!provider?.sections.find(s=>s.section===section)?.can_edit;
 const endpoint='provider-pending/'+providerId+'/items';
 const params='?section='+section+'&state='+(completed?'completed':'open');
 const send=(path:string,method:string,body:unknown)=>api(path,{method,body:JSON.stringify(body)});
 function choose(p:Provider|undefined){
  setProviderId(p?.id||'');setSection(p?.sections.find(s=>s.section==='improvements')?.section||p?.sections[0]?.section||'improvements');
  setCompleted(false);setItems([]);setDraft(null);setShowPermissions(false);setNotice('');setError('');
 }
 async function refreshProviders(id?:string){
  const {providers:rows}=await ref.current('provider-pending');
  setProviders(rows);if(!rows.length)setLoading(false);choose(rows.find((p:Provider)=>p.id===(id||providerId))||rows[0]);
 }
 useEffect(()=>{void refreshProviders().catch(e=>{setError(e.message);setLoading(false);});},[]);
 useEffect(()=>{
  if(!providerId)return;
  let current=true;setLoading(true);setItems([]);
  ref.current(endpoint+params).then(d=>{if(current)setItems(d.items);}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[providerId,section,completed,reload]);
 async function run(action:()=>Promise<void>){
  setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!draft)return;
  await run(async()=>{
   await send(endpoint+(draft.id?'/'+draft.id:'')+params,draft.id?'PATCH':'POST',draft);
   if(!draft.id)setCompleted(false);
   setDraft(null);setReload(v=>v+1);setNotice('Pendiente guardado.');
  });
 }
 async function move(item:Item){
  await run(async()=>{await send(endpoint+'/'+item.id+params,'PATCH',{completed:!item.completed_at,updated_at:item.updated_at});setReload(v=>v+1);setNotice(item.completed_at?'Pendiente reabierto.':'Enviado a Completados.');});
 }
 async function openPermissions(){
  if(showPermissions){setShowPermissions(false);return;}
  await run(async()=>{
   const [u,g]=await Promise.all([api('users'),api('provider-pending/'+providerId+'/permissions')]);
   const rows=u.users.filter((p:User)=>p.enabled&&p.role!=='admin');
   setPeople(rows);setPerson(rows[0]?.id||'');setGrants(g.permissions);setShowPermissions(true);
  });
 }
 async function assign(key:Section,mode:string){
  await run(async()=>{
   const path='provider-pending/'+providerId+'/permissions';
   await send(path,'PUT',{user_id:person,section:key,mode});
   setGrants((await api(path)).permissions);setNotice('Permiso actualizado.');
  });
 }
 function changeView(key:Section,done:boolean){
  setSection(key);setCompleted(done);setDraft(null);setError('');setNotice('');
 }
 const hasGrant=!!provider;
 return <section className="provider-pending">
  <div className="provider-pending-toolbar">
   <label>Proveedor<select value={providerId} disabled={busy||!!draft} onChange={e=>choose(providers.find(p=>p.id===e.target.value))}><option value="" disabled>Selecciona un proveedor</option>{providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   {admin&&<button type="button" className="secondary" disabled={busy} onClick={()=>setNewProvider(newProvider===null?'':null)}>Nuevo proveedor</button>}
   {admin&&hasGrant&&<button type="button" className="secondary" disabled={busy} onClick={()=>void openPermissions()}>{showPermissions?'Cerrar permisos':'Administrar permisos'}</button>}
   {canEdit&&<button type="button" className="primary" disabled={busy||!!draft} onClick={()=>{setDraft({...empty});setError('');}}>Agregar nuevo pendiente</button>}
  </div>
  {newProvider!==null&&<form className="provider-pending-card" onSubmit={e=>{e.preventDefault();void run(async()=>{const d=await send('provider-pending','POST',{name:newProvider});await refreshProviders(d.provider.id);setNewProvider(null);});}}><label>Nombre del proveedor<input required maxLength={100} value={newProvider} onChange={e=>setNewProvider(e.target.value)}/></label><button className="primary" disabled={busy}>Guardar proveedor</button></form>}
  {error&&<p role="alert" className="soft-note">{error}</p>}
  {notice&&<p role="status" className="soft-note">{notice}</p>}
  {showPermissions&&<section className="provider-pending-card"><h2>Permisos de {provider?.name}</h2>{people.length?<><label>Usuario<select disabled={busy} value={person} onChange={e=>setPerson(e.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.name} ({p.username})</option>)}</select></label><div className="provider-pending-toolbar">{Object.entries(sections).map(([key,label])=>{const g=grants.find(g=>g.user_id===person&&g.section===key);return <label key={key}>{label}<select disabled={busy} value={g?g.can_edit?'edit':'view':'none'} onChange={e=>void assign(key as Section,e.target.value)}><option value="none">Sin acceso</option><option value="view">Puede ver</option><option value="edit">Puede editar</option></select></label>;})}</div></>:<p>No hay usuarios activos para asignar.</p>}</section>}
  {!hasGrant&&<p>{loading?'Cargando…':'No hay proveedores disponibles para tu cuenta.'}</p>}
  {hasGrant&&<>
   <div className="provider-pending-tabs" aria-label="Secciones">{provider.sections.map(s=><button key={s.section} type="button" className={section===s.section?'primary':'secondary'} aria-pressed={section===s.section} disabled={busy||!!draft} onClick={()=>changeView(s.section,completed)}>{sections[s.section]}</button>)}</div>
   <div className="provider-pending-tabs" aria-label="Estado del pendiente">{[false,true].map(done=><button key={String(done)} type="button" className={completed===done?'primary':'secondary'} aria-pressed={completed===done} disabled={busy||!!draft} onClick={()=>changeView(section,done)}>{done?'Completados':'Abiertos'}</button>)}</div>
   {draft?<form className="provider-pending-card provider-pending-grid" onSubmit={save}>
    <div><h2>{draft.id?'Editar pendiente':'Nuevo pendiente'}</h2>{fields.map(([key,label,max])=><label key={key}>{label}{max>160?<textarea maxLength={max} required={key==='description'} rows={3} value={draft[key]} onChange={e=>setDraft(v=>v?{...v,[key]:e.target.value}:v)}/>:<input maxLength={max} required={key==='title'} value={draft[key]} onChange={e=>setDraft(v=>v?{...v,[key]:e.target.value}:v)}/>}</label>)}<div className="provider-pending-tabs"><button className="primary" disabled={busy}>Guardar cambios</button><button type="button" className="secondary" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button></div></div>
    <div><label>Foto de referencia<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const photo=await photoData(file);setDraft(v=>v?{...v,photo}:v);});}}/></label>{draft.photo&&<><img src={draft.photo} alt="Foto de referencia"/><button type="button" className="secondary" disabled={busy} onClick={()=>setDraft(v=>v?{...v,photo:null}:v)}>Quitar foto</button></>}</div>
   </form>:loading?<p role="status">Cargando pendientes…</p>:items.length?items.map(item=><details className="provider-pending-card" key={item.id} name="provider-pending-detail" style={{padding:'8px 12px'}}>
    <summary aria-label={'Ver detalle: '+item.title} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:10,alignItems:'center',cursor:'pointer',listStyle:'none'}}>
     <span style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{item.title}</strong>{item.location&&<small style={{display:'block',color:'#516570'}}>{item.location}</small>}</span>
     <span className="secondary" style={{padding:'5px 8px',whiteSpace:'nowrap',fontSize:12}}>Ver detalle</span>
    </summary>
    <div className={item.photo?'provider-pending-grid':undefined} style={{marginTop:10,borderTop:'1px solid #dce5e8',paddingTop:12}}><div><p>{item.description}</p>{item.suggestion&&<p><b>Sugerencia</b> · {item.suggestion}</p>}{item.solution&&<p><b>Solución</b> · {item.solution}</p>}{item.completed_at&&<p><small>Completado por {item.completed_by} el {new Date(item.completed_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}</small></p>}{canEdit&&<div className="provider-pending-tabs"><button className="secondary" disabled={busy} onClick={()=>setDraft(item)}>Editar</button><button className="primary" disabled={busy} onClick={()=>void move(item)}>{item.completed_at?'Reabrir pendiente':'Marcar como completado'}</button></div>}</div>{item.photo&&<img loading="lazy" src={item.photo} alt={'Foto de '+item.title}/>}</div></details>):<p>{completed?'Todavía no hay pendientes completados.':'No hay pendientes abiertos en esta sección.'}</p>}
  </>}
 </section>;
}
