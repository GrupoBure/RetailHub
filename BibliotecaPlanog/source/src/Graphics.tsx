import {useEffect,useRef,useState} from 'react';
import {Download,Image,Search,X} from 'lucide-react';
type Graphic={id:string;name:string;folder:string;group?:string;size:number;spec?:[string,string,number,number]};
type Api=(path:string,init?:RequestInit)=>Promise<any>;
const titles:Record<string,string>={'Desbozadoras':'Desbrozadoras','fichas diablos':'Diablos','fichas supermaq':'Super Maq 1','fichas supermaq 2':'Super Maq 2','fichas supermaq3':'Super Maq 3','PASILLOS':'Indicadores de pasillo','Lijadoras-cepillos y sierras':'Lijadoras, cepillos y sierras','Hidro y aire':'Compresores e hidrolavadoras'};
function family(path:string){const name=path.split('/').at(-1)?.replace(/[-\s]+Andrew.*$/i,'').replace(/\s*-\s*G$/i,'').replace(/[-\s]+$/,'')||'Gráficos';return titles[name]||name;}
function graphicName(x:Graphic){return x.name.replace(/\.[^.]+$/,'').replace(/[-_ ]+Andrew.*$/i,'').replace(/[-_]\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?$/i,'');}
export default function Graphics({api,admin}:{api:Api;admin:boolean}){
 const [labels,setLabels]=useState<Record<string,string>>({}),[groupError,setGroupError]=useState(''),[groupBusy,setGroupBusy]=useState(false);
 const groupOf=(x:Graphic)=>x.group??x.folder;
 const groupName=(g:string)=>Object.hasOwn(labels,g)?labels[g]:family(g);
 async function changeGroup(group:string,id?:string){
  const label=id?undefined:window.prompt('Nombre de la familia',groupName(group))?.trim();
  if(!id&&!label)return;
  setGroupBusy(true);setGroupError('');
  try{
   const d=await api('graphics/group',{method:'PATCH',body:JSON.stringify({group,id,label})});
   if(id){if(d.group!==group)throw Error('No se confirmó la familia.');setItems(xs=>xs.map(x=>x.id===id?{...x,group}:x));setSelected(x=>x?.id===id?{...x,group}:x);}
   else{if(!d.label)throw Error('No se confirmó el nombre.');setLabels(xs=>({...xs,[group]:d.label}));}
  }catch(e){setGroupError((e as Error).message);}finally{setGroupBusy(false);}
 }
 const ref=useRef(api);ref.current=api;
 const dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<Graphic[]>([]),[query,setQuery]=useState(''),[folder,setFolder]=useState(''),[selected,setSelected]=useState<Graphic|null>(null),[link,setLink]=useState<{url:string;download:string}|null>(null),[error,setError]=useState(''),[fileError,setFileError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=new AbortController();ref.current('graphics',{signal:c.signal}).then(d=>{if(!c.signal.aborted){setItems(d.graphics);setLabels(d.labels||{});}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
 useEffect(()=>{
  if(!selected)return;
  const c=new AbortController();let url='';
  dialog.current?.showModal();
  ref.current('graphics/original',{method:'POST',body:JSON.stringify({id:selected.id}),signal:c.signal}).then((blob:Blob)=>{
   if(c.signal.aborted)return;
   const mime=/\.png$/i.test(selected.name)?'image/png':/\.jpe?g$/i.test(selected.name)?'image/jpeg':'application/octet-stream';
   url=URL.createObjectURL(blob.slice(0,blob.size,mime));setLink({url,download:url});
  }).catch(e=>{if(!c.signal.aborted)setFileError(e.message);});
  return()=>{c.abort();if(url)URL.revokeObjectURL(url);};
 },[selected?.id]);
 const [draft,setDraft]=useState<string[]|null>(null),[saving,setSaving]=useState(false),[editError,setEditError]=useState(''),[batch,setBatch]=useState(''),[batchBusy,setBatchBusy]=useState(false);
 async function save(e:React.FormEvent){e.preventDefault();if(!selected||!draft)return;setSaving(true);setEditError('');try{
  const {spec}=await api('graphics/spec',{method:'PATCH',body:JSON.stringify({id:selected.id,name:draft[0],material:draft[1],width:Number(draft[2]),height:Number(draft[3])})});
  setItems(list=>list.map(x=>x.id===selected.id?{...x,spec}:x));setSelected(x=>x?.id===selected.id?{...x,spec}:x);setDraft(null);
 }catch(e){setEditError((e as Error).message);}finally{setSaving(false);}}
 async function downloadAll(){
  const picker=(window as any).showDirectoryPicker;if(!picker){setBatch('Abre este portal en Chrome o Edge de escritorio para descargar todos a una carpeta.');return;}
  setBatchBusy(true);let done=0;
  try{const root=await picker.call(window,{mode:'readwrite'});const destination=await root.getDirectoryHandle('Retail Hub - Gráficos '+new Date().toISOString().replace(/[:.]/g,'-'),{create:true});
   for(const x of items){
    setBatch('Descargando '+(done+1)+' de '+items.length+'…');
    const blob=await api('graphics/original',{method:'POST',body:JSON.stringify({id:x.id})});
    let dir=destination;for(const segment of x.folder.split('/').filter(Boolean))dir=await dir.getDirectoryHandle(segment,{create:true});
    const file=await dir.getFileHandle(x.name,{create:true});const stream=await file.createWritable();try{await stream.write(blob);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}done++;
   }
   setBatch(done+' originales descargados.');
  }catch(e){setBatch((e as Error).name==='AbortError'&&!done?'Descarga cancelada.':done+' de '+items.length+' descargados. '+(e as Error).message);}finally{setBatchBusy(false);}
 }
 const groups=[...new Set(items.flatMap(x=>[x.folder,groupOf(x)]))].sort((a,b)=>a.localeCompare(b,'es'));
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const shown=items.filter(x=>(!folder||groupOf(x)===folder)&&norm([x.name,groupName(groupOf(x)),x.spec?.[0]].join(' ')).includes(norm(query)));
 function open(x:Graphic){setLink(null);setFileError('');setDraft(null);setEditError('');setSelected(x);}
 function specs(x:Graphic){return x.spec?<><strong>{x.spec[2]} × {x.spec[3]} cm</strong><span> · {x.spec[1].replace(/(\d)\s*ml\b/gi,'$1 mm')}</span></>:<span>Especificaciones por confirmar</span>;}
 return <section className="ex-workspace"><div className="ex-top"><label><Search size={16}/> Buscar gráfico<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, código o familia"/></label><label>Familia<select value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Todas</option>{groups.map(g=><option key={g} value={g}>{groupName(g)}</option>)}</select></label></div>
 <button className="primary" disabled={batchBusy||!items.length} onClick={downloadAll}><Download size={17}/> Descargar todos los originales</button>{batch&&<p role="status">{batch}</p>}
 {groupError&&<p role="alert">{groupError}</p>}
 {loading?<p role="status">Cargando gráficos…</p>:error?<p className="error-banner" role="alert">{error}</p>:<p>{shown.length} gráficos</p>}
 {groups.filter(g=>shown.some(x=>groupOf(x)===g)).map(g=><section key={g} className="ex-notes"><h2>{groupName(g)}</h2>{admin&&<button className="secondary" disabled={groupBusy} onClick={()=>changeGroup(g)}>Renombrar familia</button>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,235px),1fr))',gap:10}}>{shown.filter(x=>groupOf(x)===g).map(x=><button key={x.id} className="secondary" style={{display:'grid',justifyItems:'start',textAlign:'left',whiteSpace:'normal',padding:14}} onClick={()=>open(x)}><Image size={22}/><strong>{graphicName(x)}</strong><span>{specs(x)}</span></button>)}</div></section>)}
 <dialog ref={dialog} onClose={()=>{setSelected(null);setLink(null);}} style={{width:'min(1080px,94vw)',maxHeight:'92vh',border:'1px solid #cbdbe3',borderRadius:14,padding:0}}>{selected&&<article>
 <header style={{background:'#173952',color:'white',padding:'18px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><div><small style={{letterSpacing:2}}>GUÍA DE IMPRESIÓN</small><h2 style={{margin:'4px 0 0',color:'inherit',textTransform:'uppercase'}}>{groupName(groupOf(selected))}</h2></div><button className="secondary" aria-label="Cerrar" onClick={()=>dialog.current?.close()}><X size={18}/></button></header>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:24,padding:24}}>
 <figure style={{margin:0,textAlign:'center',minWidth:0}}>{selected.spec&&<p><strong>↔ {selected.spec[2]} cm de ancho</strong></p>}
 {fileError?<p role="alert">{fileError}</p>:!link?<p role="status">Preparando archivo…</p>:/\.(jpe?g|png)$/i.test(selected.name)?<a href={link.url} target="_blank" rel="noreferrer" aria-label="Abrir imagen a tamaño completo"><img alt={graphicName(selected)} src={link.url} style={{display:'block',maxWidth:'100%',maxHeight:'56vh',margin:'auto',objectFit:'contain'}}/></a>:<p>Este formato se consulta descargando el original.</p>}
 {selected.spec&&<p><strong>↕ {selected.spec[3]} cm de alto</strong></p>}</figure>
 <section style={{background:'#f2f6f8',borderRadius:10,padding:20}}><small>FICHA DEL GRÁFICO</small><h3>{selected.spec?.[0]||graphicName(selected)}</h3>{admin&&<label>Familia<select disabled={groupBusy} value={groupOf(selected)} onChange={e=>changeGroup(e.target.value,selected.id)}>{groups.map(g=><option key={g} value={g}>{groupName(g)}</option>)}</select></label>}{groupError&&<p role="alert">{groupError}</p>}{admin&&(draft?<form onSubmit={save}>{['Nombre','Material','Ancho (cm)','Alto (cm)'].map((label,i)=><label key={label}>{label}<input required maxLength={160} type={i<2?'text':'number'} step={i<2?undefined:'any'} value={draft[i]} onChange={e=>setDraft(d=>d?.map((v,j)=>j===i?e.target.value:v)??null)}/></label>)}{editError&&<p role="alert">{editError}</p>}<button className="primary" disabled={saving}>Guardar especificaciones</button><button type="button" className="secondary" disabled={saving} onClick={()=>setDraft(null)}>Cancelar</button></form>:<button className="secondary" onClick={()=>{setEditError('');setDraft(selected.spec?selected.spec.map(String):[graphicName(selected),'','','']);}}>Editar especificaciones</button>)}{selected.spec?<dl><dt>Medida final (ancho × alto)</dt><dd><strong>{selected.spec[2]} × {selected.spec[3]} cm</strong></dd><dt>Material de fabricación</dt><dd>{selected.spec[1].replace(/(\d)\s*ml\b/gi,'$1 mm')}</dd></dl>:<p>Especificaciones por confirmar</p>}{link&&<a className="primary" href={link.download} download={selected.name} rel="noreferrer"><Download size={17}/> Descargar original</a>}</section>
 </div></article>}</dialog>
 </section>;
}
