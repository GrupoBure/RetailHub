import {useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Pencil,Plus,RefreshCw,Trash2} from 'lucide-react';
import './graphic-deliveries.css';

type Api=(path:string,init?:RequestInit)=>Promise<any>;
type Store={id:string;name:string};
type Article={description:string;key:string;code:string;status:string;evidence:string;source:string};
type Data={name:string;folder:string;origin:string;family:string;sourceStatus:string;path:string;articles:Article[]};
type Row={id:string;data:Data;delivered_at:string|null;delivered_by:string|null;revision:string};
const martinCarrera='20495f4b-dbe5-4aea-b025-a885ad817a83';
const pageSize=30;
const emptyArticle=():Article=>({description:'',key:'',code:'',status:'',evidence:'',source:''});
const emptyData=():Data=>({name:'',folder:'',origin:'',family:'',sourceStatus:'',path:'',articles:[]});
const clean=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export default function GraphicDeliveries({api,canManage}:{api:Api;canManage:boolean}){
 const apiRef=useRef(api);apiRef.current=api;
 const [stores,setStores]=useState<Store[]>([]),[store,setStore]=useState('');
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [draft,setDraft]=useState<{row?:Row;data:Data}|null>(null),[remove,setRemove]=useState<Row|null>(null);
 const form=useRef<HTMLFormElement>(null);
 const confirmation=useRef<HTMLDivElement>(null);
 const path='graphics/deliveries/'+store;
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  apiRef.current('stores').then(d=>{
   if(!active)return;
   const available:Store[]=d.stores;
   setStores(available);
   setStore(old=>available.some(x=>x.id===old)?old:available.find(x=>x.id===martinCarrera)?.id||available[0]?.id||'');
   if(!available.length)setLoading(false);
  }).catch(e=>{if(active){setError(e.message);setLoading(false);}});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!store)return;
  let active=true;
  setLoading(true);setRows([]);setError('');setPage(0);
  apiRef.current(path).then(d=>{if(active)setRows(d.rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[path,store,refresh]);
 useEffect(()=>{if(draft)form.current?.scrollIntoView({block:'nearest'});},[draft?.row?.id,!!draft]);
 useEffect(()=>{if(remove)confirmation.current?.scrollIntoView({block:'nearest'});},[remove]);
 const delivered=rows.filter(r=>r.delivered_at).length;
 const needle=clean(query);
 const matches=rows.filter(({data:d,delivered_at})=>(filter==='all'||(filter==='done')===!!delivered_at)&&
  (!needle||clean([d.name,d.folder,d.origin,d.family,...d.articles.flatMap(a=>[a.description,a.key,a.code])].join(' ')).includes(needle)));
 const pages=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.min(page,pages-1);
 function open(row?:Row){
  setError('');setNotice('');setRemove(null);
  setDraft({row,data:row?structuredClone(row.data):emptyData()});
 }
 async function save(action:'edit'|'toggle'|'remove',row?:Row){
  if(busy||loading)return;
  setBusy(true);setError('');setNotice('');
  const method=action==='remove'?'DELETE':row?'PATCH':'POST';
  const data=action==='edit'&&draft?{...draft.data,articles:draft.data.articles.filter(a=>a.description.trim()||a.key.trim()||a.code.trim())}:undefined;
  try{
   const result=await api(path+(row?'/'+row.id:''),{method,body:JSON.stringify({revision:row?.revision,data,delivered:action==='toggle'?!row?.delivered_at:undefined})});
   const updated:Row=result.row;
   setRows(old=>action==='remove'?old.filter(x=>x.id!==row?.id):row?old.map(x=>x.id===row.id?updated:x):[...old,updated]);
   if(action==='edit')setDraft(null);
   if(action==='remove')setRemove(null);
   setNotice(action==='toggle'?(updated.delivered_at?'Marcado como entregado.':'Marcado como pendiente.'):action==='remove'?'Fila retirada del seguimiento.':'Fila guardada.');
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 function setData(key:'name'|'folder'|'origin'|'family',value:string){
  setDraft(old=>old&&({...old,data:{...old.data,[key]:value}}));
 }
 function setArticle(index:number,key:'description'|'key'|'code',value:string){
  setDraft(old=>old&&({...old,data:{...old.data,articles:old.data.articles.map((a,i)=>i===index?{...emptyArticle(),description:a.description,key:a.key,code:a.code,[key]:value}:a)}}));
 }
 return <section className="panel graphic-deliveries" aria-label="Entregas de gráficos">
  <div className="gd-heading"><div><h2>Entregas de gráficos</h2><p>Marca lo recibido y consulta lo que falta por tienda.</p></div>
   <label>Tienda<select value={store} disabled={busy||!stores.length} onChange={e=>{if(e.target.value===store)return;setLoading(true);setRows([]);setStore(e.target.value);setDraft(null);setRemove(null);setQuery('');setFilter('all');setNotice('');}}>
    {!stores.length&&<option value="">Sin tiendas disponibles</option>}
    {stores.map(s=><option key={s.id} value={s.id}>{s.id===martinCarrera?'Martín Carrera':s.name}</option>)}
   </select></label>
  </div>
  {store&&<><div className="gd-filters">
   <label>Buscar<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Gráfico, carpeta, clave o código"/></label>
   <label>Estado<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="done">Entregados</option></select></label>
   <button className="text-link" type="button" disabled={busy||loading||!!draft||!!remove} onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15}/>Actualizar</button>
   {canManage&&<button className="secondary small" type="button" disabled={busy||loading||!!draft||!!remove} onClick={()=>open()}><Plus size={16}/>Agregar fila</button>}
  </div>
  {!loading&&<p className="gd-count"><strong>{delivered} entregados</strong><span>{rows.length-delivered} pendientes</span><span>{rows.length} en total</span></p>}
  {error&&<p className="error-banner" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {draft&&<form ref={form} className="gd-editor" onSubmit={e=>{e.preventDefault();void save('edit',draft.row);}}>
   <h3>{draft.row?'Editar gráfico':'Agregar gráfico'}</h3>
   <div className="gd-edit-grid">
    <label>Nombre del gráfico<input autoFocus required maxLength={220} value={draft.data.name} onChange={e=>setData('name',e.target.value)}/></label>
    <label>Carpeta<input maxLength={240} value={draft.data.folder} onChange={e=>setData('folder',e.target.value)}/></label>
    <label>Origen<input maxLength={240} value={draft.data.origin} onChange={e=>setData('origin',e.target.value)}/></label>
    <label>Familia<input maxLength={300} value={draft.data.family} onChange={e=>setData('family',e.target.value)}/></label>
   </div>
   <h4>Artículos de Truper</h4>
   {draft.data.articles.map((a,i)=><div className="gd-article-edit" key={i}>
    <label>Artículo<input maxLength={350} value={a.description} onChange={e=>setArticle(i,'description',e.target.value)}/></label>
    <label>Clave<input maxLength={100} value={a.key} onChange={e=>setArticle(i,'key',e.target.value)}/></label>
    <label>Código<input maxLength={32} value={a.code} onChange={e=>setArticle(i,'code',e.target.value)}/></label>
    <button type="button" className="icon-btn" aria-label={`Quitar artículo ${i+1}`} onClick={()=>setDraft(old=>old&&({...old,data:{...old.data,articles:old.data.articles.filter((_,j)=>j!==i)}}))}><Trash2 size={15}/></button>
   </div>)}
   <button type="button" className="text-link" disabled={draft.data.articles.length>=200} onClick={()=>setDraft(old=>old&&({...old,data:{...old.data,articles:[...old.data.articles,emptyArticle()]}}))}><Plus size={15}/>Agregar artículo</button>
   <div className="gd-actions"><button className="primary small" disabled={busy}>Guardar fila</button><button type="button" className="secondary small" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button></div>
  </form>}
  {remove&&<div ref={confirmation} className="gd-editor" role="group" aria-label="Confirmar retiro"><p>¿Quitar <strong>{remove.data.name}</strong> del seguimiento de esta tienda? El archivo original se conserva.</p><div className="gd-actions"><button className="primary danger-button small" disabled={busy} onClick={()=>void save('remove',remove)}>Quitar fila</button><button className="secondary small" disabled={busy} onClick={()=>setRemove(null)}>Cancelar</button></div></div>}
  {loading?<p role="status">Cargando entregas…</p>:matches.length===0?<p>{rows.length?'No hay gráficos con estos filtros.':error?'':'Todavía no hay gráficos en el seguimiento de esta tienda.'}</p>:<>
   <div className="table-scroll"><table className="gd-table">
    <thead><tr><th>Entregado</th><th>Gráfico</th><th>Artículo y clave</th>{canManage&&<th>Acciones</th>}</tr></thead>
    <tbody>{matches.slice(current*pageSize,(current+1)*pageSize).map(row=>{
     const d=row.data;
     return <tr key={row.id}>
      <td>{canManage?<input type="checkbox" checked={!!row.delivered_at} disabled={busy||!!draft||!!remove} aria-label={'Entregado: '+d.name} onChange={()=>void save('toggle',row)}/>:row.delivered_at?<Check size={17} aria-label="Entregado"/>:'Pendiente'}
       {row.delivered_at&&<small>{new Date(row.delivered_at).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'})}{row.delivered_by?' · '+row.delivered_by:''}</small>}</td>
      <td><strong>{d.name}</strong><small>{[d.folder,d.origin].filter(Boolean).join(' · ')}</small></td>
      <td>{d.articles.length>1?<details><summary>{d.articles.length} artículos</summary><ul>{d.articles.map((a,i)=><li key={i}>{[a.description,a.key,a.code].filter(Boolean).join(' · ')}</li>)}</ul></details>:d.articles.length===1?[d.articles[0].description,d.articles[0].key,d.articles[0].code].filter(Boolean).join(' · '):d.family||d.sourceStatus||'—'}</td>
      {canManage&&<td><div className="gd-actions"><button type="button" className="icon-btn" title="Editar" aria-label={'Editar '+d.name} disabled={busy||!!draft||!!remove} onClick={()=>open(row)}><Pencil size={15}/></button><button type="button" className="icon-btn danger-icon" title="Quitar fila" aria-label={'Quitar '+d.name} disabled={busy||!!draft||!!remove} onClick={()=>{setError('');setRemove(row);}}><Trash2 size={15}/></button></div></td>}
     </tr>;
    })}</tbody></table></div>
   {pages>1&&<div className="gd-pagination"><button className="secondary small" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/>Anterior</button><span>Página {current+1} de {pages} · {matches.length} gráficos</span><button className="secondary small" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Siguiente<ChevronRight size={16}/></button></div>}
  </>}
  </>}
  {!store&&(loading?<p role="status">Cargando tiendas…</p>:error?<p role="alert">{error}</p>:<p>No tienes tiendas asignadas para seguimiento.</p>)}
 </section>;
}
