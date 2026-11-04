import {useEffect,useRef,useState} from 'react';
import {Download,Image,Search,X} from 'lucide-react';
type Graphic={id:string;name:string;folder:string;size:number;spec?:[string,string,number,number]};
type Api=(path:string,init?:RequestInit)=>Promise<any>;
export default function Graphics({api}:{api:Api}){
 const ref=useRef(api);ref.current=api;
 const dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<Graphic[]>([]),[query,setQuery]=useState(''),[folder,setFolder]=useState(''),[selected,setSelected]=useState<Graphic|null>(null),[link,setLink]=useState<{url:string;download:string}|null>(null),[error,setError]=useState(''),[fileError,setFileError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=new AbortController();ref.current('graphics',{signal:c.signal}).then(d=>{if(!c.signal.aborted)setItems(d.graphics);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
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
 },[selected]);
 const groups=[...new Set(items.map(x=>x.folder))].sort((a,b)=>a.localeCompare(b,'es'));
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const shown=items.filter(x=>(!folder||x.folder===folder)&&norm([x.name,x.folder,x.spec?.[0]].join(' ')).includes(norm(query)));
 function open(x:Graphic){setLink(null);setFileError('');setSelected(x);}
 function specs(x:Graphic){return x.spec?<><strong>{x.spec[2]} × {x.spec[3]} cm</strong><span> · {x.spec[1].replace(/(\d)\s*ml\b/gi,'$1 mm')}</span></>:<span>Especificaciones por confirmar</span>;}
 return <section className="ex-workspace"><div className="ex-top"><label><Search size={16}/> Buscar gráfico<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, código o familia"/></label><label>Familia<select value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Todas</option>{groups.map(g=><option key={g} value={g}>{g||'Sin carpeta'}</option>)}</select></label></div>
 {loading?<p role="status">Cargando gráficos…</p>:error?<p className="error-banner" role="alert">{error}</p>:<p>{shown.length} gráficos</p>}
 {groups.filter(g=>shown.some(x=>x.folder===g)).map(g=><section key={g} className="ex-notes"><h2>{g||'Gráficos'}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,235px),1fr))',gap:10}}>{shown.filter(x=>x.folder===g).map(x=><button key={x.id} className="secondary" style={{display:'grid',justifyItems:'start',textAlign:'left',whiteSpace:'normal',padding:14}} onClick={()=>open(x)}><Image size={22}/><strong>{x.name}</strong><span>{specs(x)}</span></button>)}</div></section>)}
 <dialog ref={dialog} onClose={()=>{setSelected(null);setLink(null);}} style={{width:'min(960px,94vw)',maxHeight:'92vh',border:'1px solid #cbdbe3',borderRadius:14,padding:24}}>{selected&&<><div className="ex-actions" style={{justifyContent:'space-between'}}><h2>{selected.name}</h2><button className="secondary" aria-label="Cerrar" onClick={()=>dialog.current?.close()}><X size={18}/></button></div><p>{selected.folder}</p><p>{specs(selected)}</p>
 {fileError?<p role="alert">{fileError}</p>:!link?<p role="status">Preparando archivo…</p>:<>{/\.(jpe?g|png)$/i.test(selected.name)&&<img alt={selected.name} src={link.url} onError={e=>{e.currentTarget.hidden=true;}} style={{display:'block',maxWidth:'100%',maxHeight:'60vh',margin:'auto',objectFit:'contain'}}/>}<a className="primary" href={link.download} download={selected.name} rel="noreferrer"><Download size={17}/> Descargar original</a></>}</>}</dialog>
 </section>;
}
