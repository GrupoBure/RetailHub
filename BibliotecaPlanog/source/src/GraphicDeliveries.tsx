import {Fragment,useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Download,Pencil,Plus,RefreshCw,Trash2,Upload} from 'lucide-react';
import {tabularWorkbook} from './activity-model';
import './graphic-deliveries.css';

type Api=(path:string,init?:RequestInit)=>Promise<any>;
type Store={id:string;name:string};
type Article={description:string;key:string;code:string;status:string;evidence:string;source:string};
type Data={name:string;folder:string;origin:string;family:string;sourceStatus:string;path:string;notes?:string;articles:Article[]};
const notesLimit=2000;
type Row={id:string;data:Data;delivered_at:string|null;delivered_by:string|null;revision:string};
const martinCarrera='20495f4b-dbe5-4aea-b025-a885ad817a83';
const pageSize=30;
const emptyArticle=():Article=>({description:'',key:'',code:'',status:'',evidence:'',source:''});
const emptyData=():Data=>({name:'',folder:'',origin:'',family:'',sourceStatus:'',path:'',articles:[]});
const clean=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function isVisibleDelivery(data:Pick<Data,'folder'|'origin'|'path'>){
 return ![data.folder,data.origin,data.path].some(value=>value.split(/[\\/·]/).some(part=>{
  const name=clean(part).replace(/[_\s-]+/g,' ');
  return name==='graficos no visibles'||name==='guias de impresion';
 }));
}
const deliveryDate=(row:Row)=>row.delivered_at?new Date(row.delivered_at).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'}):'';
const articleRows=(data:Data)=>data.articles.length?data.articles:[{...emptyArticle(),description:data.family||''}];
type ImportRow={id:string|null;data:Data};
export function parseDeliveryRows(rows:string[][]):ImportRow[]{
 const aliases=[['codigo'],['nombre del grafico','nombre','grafico'],['clave'],['descripcion','articulo de grupo truper'],['carpeta'],['origen'],['id de grafico'],['ruta de origen'],['notas']];
 const header=rows.slice(0,20).findIndex(row=>aliases.slice(0,4).every(options=>options.some(x=>row.some(value=>clean(value)===x))));
 if(header<0)throw Error('La primera hoja debe tener Código, Nombre del gráfico, Clave y Descripción.');
 const fields=aliases.map(options=>rows[header].findIndex(value=>options.includes(clean(value))));
 const grouped=new Map<string,ImportRow>();
 for(let i=header+1;i<rows.length;i++){
  if(!rows[i].some(x=>x.trim()))continue;
  const [code,name,key,description,folder,origin,id,path,notes]=fields.map(j=>rows[i][j]?.trim()||'');
  const invalid=!name||[code,key,description].some(x=>/^ver (?:detalle|[«"]?articulos)/.test(clean(x)))||
   [code,name,key,description,folder,origin,path,notes].some((x,j)=>x.length>[32,220,100,350,240,240,1000,notesLimit][j])||
   (id&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id));
  if(invalid)throw Error(`Revisa la fila ${i+1}: faltan datos o hay valores inválidos. Usa una línea por código.`);
  const identity=JSON.stringify([name,folder,origin,path]);
  const groupKey=id?id.toLowerCase():identity;
  const group=grouped.get(groupKey)||{id:id.toLowerCase()||null,data:{...emptyData(),name,folder,origin,path}};
  const d=group.data;
  if(JSON.stringify([d.name,d.folder,d.origin,d.path])!==identity)throw Error(`El ID de la fila ${i+1} corresponde a más de un gráfico.`);
  if(d.notes&&notes&&d.notes!==notes)throw Error(`El gráfico «${name}» tiene notas distintas en el Excel.`);
  if(fields[8]>=0)d.notes=d.notes||notes;
  if(code||key||description){
   if(d.articles.length>=200)throw Error(`El gráfico «${name}» supera 200 artículos.`);
   d.articles.push({...emptyArticle(),code,key,description});
  }
  grouped.set(groupKey,group);
 }
 if(!grouped.size||grouped.size>4000)throw Error('El archivo debe contener de 1 a 4,000 gráficos.');
 return [...grouped.values()];
}

export default function GraphicDeliveries({api,canManage}:{api:Api;canManage:boolean}){
 const apiRef=useRef(api);apiRef.current=api;
 const [stores,setStores]=useState<Store[]>([]),[store,setStore]=useState('');
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [draft,setDraft]=useState<{row?:Row;data:Data}|null>(null),[remove,setRemove]=useState<Row|null>(null);
 const [replacement,setReplacement]=useState<{name:string;rows:ImportRow[];expected:string[]}|null>(null);
 const upload=useRef<HTMLInputElement>(null);
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
 const visibleRows=rows.filter(r=>isVisibleDelivery(r.data));
 const delivered=visibleRows.filter(r=>r.delivered_at).length;
 const needle=clean(query);
 const matches=visibleRows.filter(({data:d,delivered_at})=>(filter==='all'||(filter==='done')===!!delivered_at)&&
  (!needle||clean([d.name,d.folder,d.origin,d.family,d.notes,...d.articles.flatMap(a=>[a.description,a.key,a.code])].join(' ')).includes(needle)));
 const pages=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.min(page,pages-1);
 const storeName=store===martinCarrera?'Martín Carrera':stores.find(s=>s.id===store)?.name||'Tienda';
 async function previewExcel(file:File){
  setBusy(true);setError('');setNotice('');setReplacement(null);
  try{
   if(!/\.xlsx$/i.test(file.name)||file.size>20000000||!file.size)throw Error('Selecciona un archivo XLSX de hasta 20 MB.');
   const {readXlsx}=await import('./quote-import');
   const incoming=parseDeliveryRows(await readXlsx(await file.arrayBuffer(),10001,true)).filter(row=>isVisibleDelivery(row.data));
   if(!incoming.length)throw Error('El Excel no contiene gráficos de carpetas visibles.');
   const hiddenIds=new Set(rows.filter(row=>!isVisibleDelivery(row.data)).map(row=>row.id));
   if(incoming.some(row=>row.id&&hiddenIds.has(row.id)))throw Error('El Excel incluye un ID de una carpeta no visible.');
   for(const row of incoming){
    if(row.data.notes!==undefined)continue;
    const previous=visibleRows.filter(old=>row.id?row.id===old.id:
      row.data.name===old.data.name&&row.data.folder===old.data.folder&&row.data.origin===old.data.origin);
    if(previous.length===1)row.data.notes=previous[0].data.notes;
   }
   setReplacement({name:file.name,rows:incoming,expected:rows.map(r=>r.revision)});
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function replaceExcel(){
  if(!replacement||busy)return;
  setBusy(true);setError('');
  try{
   const hidden=rows.filter(row=>!isVisibleDelivery(row.data)).map(({id,data})=>({id,data}));
   await api(path+'/replace',{method:'POST',body:JSON.stringify({rows:[...replacement.rows,...hidden],expected:replacement.expected})});
   setReplacement(null);setQuery('');setFilter('all');setLoading(true);setRefresh(x=>x+1);
   setNotice(`Se cargaron ${replacement.rows.length} gráficos en ${storeName}.`);
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 function exportExcel(){
  const table=[['Código','Nombre del gráfico','Clave','Descripción','Estado','Carpeta','Origen','Fecha de entrega','Registró','Tienda','ID de gráfico','Ruta de origen','Notas'],
   ...matches.flatMap(row=>articleRows(row.data).map(a=>[a.code,row.data.name,a.key,a.description,row.delivered_at?'Entregado':'Pendiente',row.data.folder,row.data.origin,deliveryDate(row),row.delivered_by||'',storeName,row.id,row.data.path,row.data.notes||'']))];
  const book=tabularWorkbook(table,'Entregas',[15,52,20,64,17,29,29,20,20,22,40,52,38]);
  const url=URL.createObjectURL(new Blob([book.buffer as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');
  link.href=url;link.download='Entregas de gráficos - '+storeName.replace(/[\\/:*?"<>|]/g,'-')+'.xlsx';
  document.body.append(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
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
 function setData(key:'name'|'folder'|'origin'|'family'|'notes',value:string){
  setDraft(old=>old&&({...old,data:{...old.data,[key]:value}}));
 }
 function setArticle(index:number,key:'description'|'key'|'code',value:string){
  setDraft(old=>old&&({...old,data:{...old.data,articles:old.data.articles.map((a,i)=>i===index?{...emptyArticle(),description:a.description,key:a.key,code:a.code,[key]:value}:a)}}));
 }
 return <section className="panel graphic-deliveries" aria-label="Entregas de gráficos">
  <div className="gd-heading"><div><h2>Entregas de gráficos</h2><p>Marca lo recibido y consulta lo que falta por tienda.</p></div>
   <label>Tienda<select value={store} disabled={busy||!!replacement||!stores.length} onChange={e=>{if(e.target.value===store)return;setLoading(true);setRows([]);setStore(e.target.value);setDraft(null);setRemove(null);setQuery('');setFilter('all');setNotice('');}}>
    {!stores.length&&<option value="">Sin tiendas disponibles</option>}
    {stores.map(s=><option key={s.id} value={s.id}>{s.id===martinCarrera?'Martín Carrera':s.name}</option>)}
   </select></label>
  </div>
  {store&&<><div className="gd-filters">
   <label>Buscar<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Gráfico, carpeta, clave o código"/></label>
   <label>Estado<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="done">Entregados</option></select></label>
   <button className="text-link" type="button" disabled={busy||loading||!!draft||!!remove||!!replacement} onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15}/>Actualizar</button>
   <button className="secondary small" type="button" disabled={busy||loading||!matches.length} onClick={exportExcel}><Download size={16}/>Exportar a Excel</button>
   {canManage&&<>
    <input ref={upload} type="file" accept=".xlsx" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void previewExcel(file);}}/>
    <button className="secondary small" type="button" disabled={busy||loading||!!draft||!!remove||!!replacement} onClick={()=>upload.current?.click()}><Upload size={16}/>Reemplazar con Excel</button>
    <button className="secondary small" type="button" disabled={busy||loading||!!draft||!!remove||!!replacement} onClick={()=>open()}><Plus size={16}/>Agregar fila</button>
   </>}
  </div>
  {!loading&&<p className="gd-count"><strong>{delivered} entregados</strong><span>{visibleRows.length-delivered} pendientes</span><span>{visibleRows.length} en total</span></p>}
  {error&&<p className="error-banner" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {replacement&&<div className="gd-editor" role="group" aria-label="Confirmar reemplazo con Excel">
   <h3>Reemplazar lista de {storeName}</h3>
   <p><strong>{replacement.name}</strong> cargará {replacement.rows.length} gráficos visibles en lugar de los {visibleRows.length} actuales. Los gráficos visibles que falten en el Excel se quitarán del seguimiento de esta tienda.</p>
   <p>Las entregas registradas se conservan al coincidir el ID o, cuando falta el ID, un único nombre con la misma carpeta y origen. Los gráficos nuevos quedan pendientes.</p>
   <div className="gd-actions"><button className="primary danger-button small" disabled={busy} onClick={()=>void replaceExcel()}>{busy?'Reemplazando…':'Confirmar reemplazo'}</button><button className="secondary small" disabled={busy} onClick={()=>setReplacement(null)}>Cancelar</button></div>
  </div>}
  {draft&&<form ref={form} className="gd-editor" onSubmit={e=>{e.preventDefault();void save('edit',draft.row);}}>
   <h3>{draft.row?'Editar gráfico':'Agregar gráfico'}</h3>
   <div className="gd-edit-grid">
    <label>Nombre del gráfico<input autoFocus required maxLength={220} value={draft.data.name} onChange={e=>setData('name',e.target.value)}/></label>
    <label>Carpeta<input maxLength={240} value={draft.data.folder} onChange={e=>setData('folder',e.target.value)}/></label>
    <label>Origen<input maxLength={240} value={draft.data.origin} onChange={e=>setData('origin',e.target.value)}/></label>
    <label>Familia<input maxLength={300} value={draft.data.family} onChange={e=>setData('family',e.target.value)}/></label>
   </div>
   <label>Notas<textarea rows={3} maxLength={notesLimit} value={draft.data.notes??''} onChange={e=>setData('notes',e.target.value)}/></label>
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
  {loading?<p role="status">Cargando entregas…</p>:matches.length===0?<p>{visibleRows.length?'No hay gráficos con estos filtros.':error?'':'Todavía no hay gráficos visibles en el seguimiento de esta tienda.'}</p>:<>
   <div className="table-scroll"><table className="gd-table">
    <thead><tr><th>Entregado</th><th>Código</th><th>Nombre del gráfico</th><th>Clave</th><th>Descripción</th><th>Notas</th>{canManage&&<th>Acciones</th>}</tr></thead>
    <tbody>{matches.slice(current*pageSize,(current+1)*pageSize).map(row=>{
     const d=row.data;
     const articles=articleRows(d);
     return <Fragment key={row.id}>{articles.map((a,i)=><tr key={i}>
{i===0&&<td rowSpan={articles.length}>{canManage?<input type="checkbox" checked={!!row.delivered_at} disabled={busy||!!draft||!!remove||!!replacement} aria-label={'Entregado: '+d.name} onChange={()=>void save('toggle',row)}/>:row.delivered_at?<Check size={17} aria-label="Entregado"/>:'Pendiente'}
       {row.delivered_at&&<small>{deliveryDate(row)}{row.delivered_by?' · '+row.delivered_by:''}</small>}</td>}
      <td>{a.code||'—'}</td>
      {i===0&&<td rowSpan={articles.length}><strong>{d.name}</strong><small>{[d.folder,d.origin].filter(Boolean).join(' · ')}</small></td>}
      <td>{a.key||'—'}</td>
      <td>{a.description||'—'}</td>
      {i===0&&<td rowSpan={articles.length} style={{minWidth:150,maxWidth:260,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{d.notes||'—'}</td>}
{i===0&&canManage&&<td rowSpan={articles.length}><div className="gd-actions"><button type="button" className="icon-btn" title="Editar" aria-label={'Editar '+d.name} disabled={busy||!!draft||!!remove||!!replacement} onClick={()=>open(row)}><Pencil size={15}/></button><button type="button" className="icon-btn danger-icon" title="Quitar fila" aria-label={'Quitar '+d.name} disabled={busy||!!draft||!!remove||!!replacement} onClick={()=>{setError('');setRemove(row);}}><Trash2 size={15}/></button></div></td>}
     </tr>)}</Fragment>;
    })}</tbody></table></div>
   {pages>1&&<div className="gd-pagination"><button className="secondary small" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/>Anterior</button><span>Página {current+1} de {pages} · {matches.length} gráficos</span><button className="secondary small" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Siguiente<ChevronRight size={16}/></button></div>}
  </>}
  </>}
  {!store&&(loading?<p role="status">Cargando tiendas…</p>:error?<p role="alert">{error}</p>:<p>No tienes tiendas asignadas para seguimiento.</p>)}
 </section>;
}
