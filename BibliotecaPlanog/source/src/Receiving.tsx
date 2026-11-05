import {useEffect,useRef,useState} from 'react';
import {ScanLine,Search,PackageCheck,MapPin,ArrowRight,RefreshCw,ExternalLink,ImageOff,LoaderCircle,CheckCircle2,AlertTriangle,FolderOpen} from 'lucide-react';
import {findReceivingProduct,isProductPlanned,isUnplanned,normalizeReceivingInput,receivingImageURLs,receivingKey,receivingSheetURL} from './receiving-model';
import type {ReceivingIndex,ReceivingMatch,ReceivingProduct} from './receiving-model';
import './receiving.css';
type Store={id:string;name:string;enabled:boolean};
type Doc={id:string;filename:string;modified_at:string;published:boolean};
type Api=(path:string,init?:RequestInit)=>Promise<any>;
const isReceivingBase=(d:Doc)=>/^listadocodigosxgondola|^listadocodigosporgondola|^baserecepcion/.test(receivingKey(d.filename))&&/\.xlsx$/i.test(d.filename);
const baseLabel=(filename:string)=>filename.replace(/\.xlsx$/i,'');
function readBase(buffer:ArrayBuffer,signal:AbortSignal,onProgress:(s:string)=>void):Promise<ReceivingIndex>{
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./receiving-worker.ts',import.meta.url),{type:'module'});let finished=false;
  const stop=()=>{worker.terminate();signal.removeEventListener('abort',abort);};
  const abort=()=>{if(finished)return;finished=true;stop();reject(new DOMException('Lectura cancelada.','AbortError'));};
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{if(event.data.progress){onProgress(event.data.progress);return;}if(finished)return;finished=true;stop();if(event.data.ok)resolve(event.data.index);else reject(Error(event.data.error||'No se pudo leer la base.'));};
  worker.onerror=()=>{if(finished)return;finished=true;stop();reject(Error('No se pudo preparar la búsqueda. Actualiza la página e intenta de nuevo.'));};worker.postMessage(buffer,[buffer]);
 });
}
function ProductPhoto({product}:{product:ReceivingProduct}){
 const urls=receivingImageURLs(product.key),[attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState(false),[zoom,setZoom]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 const src=urls[attempt];
 useEffect(()=>{if(zoom)dialog.current?.showModal();},[zoom]);
 return <div className="rx-photo-panel"><div className="rx-photo-heading"><span>FOTOGRAFÍA DEL PRODUCTO</span><span>TRUPER</span></div>
 <div className="rx-photo">{src?<><img src={src} alt={product.description} referrerPolicy="no-referrer" onLoad={()=>setLoaded(true)} onError={()=>{setLoaded(false);setAttempt(i=>i+1);}} style={{opacity:loaded?1:0}}/>{!loaded&&<div className="rx-photo-state" role="status"><LoaderCircle size={30} className="spin"/><span>Cargando fotografía de Truper…</span></div>}{loaded&&<button type="button" className="secondary rx-enlarge" onClick={()=>setZoom(true)}>Ampliar imagen</button>}</>:<div className="rx-photo-state"><ImageOff size={36}/><strong>Fotografía no disponible</strong><span>Truper no devolvió una imagen para esta clave. La ubicación y los datos del Excel siguen disponibles.</span></div>}</div>
 <a className="rx-source" href={receivingSheetURL(product.code)} target="_blank" rel="noreferrer">Consultar ficha oficial de Truper <ExternalLink size={14}/></a>
 <dialog ref={dialog} className="rx-image-dialog" onClose={()=>setZoom(false)}><button className="secondary" onClick={()=>dialog.current?.close()}>Cerrar imagen</button>{src&&<img src={src} alt={product.description}/>}</dialog></div>;
}
export default function Receiving({api,admin,visible,stores,store,onStore,preview=false}:{api:Api;admin:boolean;visible:boolean;stores:Store[];store:Store|null;onStore:(s:Store|null)=>void;preview?:boolean}){
 const apiRef=useRef(api);apiRef.current=api;
 const [index,setIndex]=useState<ReceivingIndex|null>(null),[document,setDocument]=useState<Doc|null>(null),[phase,setPhase]=useState(''),[error,setError]=useState(''),[reload,setReload]=useState(0),[query,setQuery]=useState(''),[match,setMatch]=useState<ReceivingMatch|null>(null),[recent,setRecent]=useState<ReceivingProduct[]>([]);
 const input=useRef<HTMLInputElement>(null),lastLookup=useRef({query:'',at:0}),cached=useRef<{store:string;document:Doc;index:ReceivingIndex}|null>(null);
 useEffect(()=>{if(!visible||!stores.length)return;if(store&&stores.some(s=>s.id===store.id))return;onStore(stores.find(s=>receivingKey(s.name).includes('martincarrera'))||stores[0]);},[visible,stores,store?.id]);
 useEffect(()=>{
  if(!visible)return;setQuery('');setMatch(null);setRecent([]);lastLookup.current={query:'',at:0};setError('');
  if(!store){setIndex(null);setDocument(null);setPhase('');return;}if(preview){setPhase('');setIndex(null);return;}
  const controller=new AbortController(),signal=controller.signal;let active=true;
  setIndex(null);setDocument(null);setPhase('Buscando la base de recepción de esta tienda…');
  const list=async()=>{const result=await apiRef.current('documents?store='+encodeURIComponent(store.id),{signal});if(!Array.isArray(result.documents))throw Error('No se pudo consultar la base de esta tienda.');return (result.documents as Doc[]).filter(isReceivingBase).sort((a,b)=>b.modified_at.localeCompare(a.modified_at));};
  (async()=>{try{
   let docs=await list();
   if(!docs.length&&admin){setPhase('Sincronizando la base que está en Dropbox…');let cursor:string|null=null;do{signal.throwIfAborted();const result=await apiRef.current('sync',{method:'POST',body:JSON.stringify({cursor}),signal});cursor=result.cursor||null;}while(cursor);docs=await list();}
   if(!docs.length)throw Error(admin?'No hay una base de recepción para esta tienda. Coloca el XLSX en su carpeta Listados con un nombre que comience por “Listado códigos x gondola” y pulsa Actualizar base.':'La base de recepción de esta tienda todavía no está disponible. Pide al administrador que la active.');
   const doc=docs[0];
   if(admin&&!doc.published){setPhase('Activando la base para los usuarios autorizados de esta tienda…');await apiRef.current('documents/'+doc.id,{method:'PATCH',body:JSON.stringify({published:true}),signal});doc.published=true;}
   if(cached.current?.store===store.id&&cached.current.document.id===doc.id&&cached.current.document.modified_at===doc.modified_at){if(active){setIndex(cached.current.index);setDocument(doc);setPhase('');}return;}
   setPhase('Descargando la base privada desde Dropbox…');const link=await apiRef.current('documents/'+doc.id+'/link',{method:'POST',signal});if(typeof link.url!=='string')throw Error('No se pudo abrir la base de recepción.');
   const response=await fetch(link.url,{signal});if(!response.ok)throw Error('No se pudo descargar la base. Pulsa Actualizar base para intentar de nuevo.');const length=Number(response.headers.get('content-length'));if(length>20000000)throw Error('La base supera 20 MB.');
   const buffer=await response.arrayBuffer();signal.throwIfAborted();const data=await readBase(buffer,signal,s=>{if(active)setPhase(s);});
   cached.current={store:store.id,document:doc,index:data};if(active){setDocument(doc);setIndex(data);setPhase('');}
  }catch(e){if(active&&!signal.aborted){setError((e as Error).message);setPhase('');}}})();
  return()=>{active=false;controller.abort();};
 },[store?.id,visible,reload,admin,preview]);
 useEffect(()=>{if(visible&&index)input.current?.focus();},[visible,index]);
 function lookup(value=query){
  if(!index)return;const normalized=normalizeReceivingInput(value);if(!normalized)return;
  if(lastLookup.current.query===normalized&&Date.now()-lastLookup.current.at<600)return;lastLookup.current={query:normalized,at:Date.now()};
  const result=findReceivingProduct(index,value);setMatch(result);if(result.kind==='found')setRecent(xs=>[result.product,...xs.filter(x=>x.code!==result.product.code)].slice(0,8));input.current?.focus();input.current?.select();
 }
 useEffect(()=>{if(!visible||!index)return;const normalized=normalizeReceivingInput(query);if(!index.barcodes.has(normalized))return;const timer=setTimeout(()=>lookup(query),250);return()=>clearTimeout(timer);},[query,index,visible]);
 if(!visible)return null;
 const product=match?.kind==='found'?match.product:null,planned=product?isProductPlanned(product):false;
 const locationValues=(field:'family'|'aisle')=>product?[...new Set(product.locations.map(l=>l[field]).filter(v=>!isUnplanned(v)))].join(' · '):'';
 return <section className="rx-workspace" aria-label="Recepción y clasificación de producto">
  <div className="rx-toolbar"><label className="rx-store-label"><FolderOpen size={17}/> Tienda<select aria-label="Tienda de recepción" value={stores.some(s=>s.id===store?.id)?store!.id:''} onChange={e=>onStore(stores.find(s=>s.id===e.target.value)||null)}><option value="">Selecciona una tienda</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button type="button" className="secondary" disabled={!store||!!phase||preview} onClick={()=>{cached.current=null;setReload(n=>n+1);}}><RefreshCw size={16}/>Actualizar base</button></div>
  {preview&&<p className="rx-note">La vista de diseño no consulta productos reales. Inicia sesión para abrir la base autorizada de tu tienda.</p>}
  {phase&&<div className="rx-loading" role="status"><LoaderCircle className="spin" size={24}/><div><strong>Preparando recepción</strong><p>{phase}</p></div></div>}
  {error&&<div className="rx-alert" role="alert"><AlertTriangle size={21}/><div><strong>No se pudo cargar la base</strong><p>{error}</p></div></div>}
  <form className="rx-search-panel" onSubmit={e=>{e.preventDefault();lookup();}}><div className="rx-search-title"><span className="rx-scan-icon"><ScanLine size={27}/></span><div><h2>¿A dónde va este producto?</h2><p>Escanea el código de barras o escribe el código de producto Truper.</p></div>{index&&<span className="rx-ready"><i/>Lector listo</span>}</div>
   <label htmlFor="rx-code">Código de barras o código de producto</label><div className="rx-input-line"><ScanLine size={22} aria-hidden="true"/><input id="rx-code" ref={input} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={48} value={query} disabled={!index||!!phase} onChange={e=>setQuery(e.target.value)} placeholder="Escanea aquí o escribe el código"/><button className="primary" disabled={!index||!!phase||!query.trim()}><Search size={18}/>Buscar</button></div>
   <div className="rx-search-foot"><span>Lectores USB o Bluetooth: escanea con este campo activo. También puedes escribir y pulsar Enter.</span>{query&&<button type="button" className="text-link" onClick={()=>{setQuery('');setMatch(null);input.current?.focus();}}>Limpiar</button>}</div>
  </form>
  <div aria-live="polite" aria-atomic="false">
  {product?<article className={'rx-result '+(planned?'rx-planned':'rx-unplanned')}>
   <header className="rx-location-header"><div className="rx-family"><small>FAMILIA</small><h2>{locationValues('family')||'Sin familia asignada'}</h2></div><div className="rx-aisle"><small>PASILLO</small><strong>{locationValues('aisle')||'Sin asignar'}</strong></div></header>
   <div className="rx-product-layout"><ProductPhoto key={product.code} product={product}/><section className="rx-product-info"><span className={'rx-status '+(planned?'':'rx-status-warning')}>{planned?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {planned?'Producto planogramado':'No planogramado'}</span><div className="rx-product-code"><small>CÓDIGO TRUPER</small><strong>{product.code}</strong></div><h2>{product.description}</h2><p className="rx-product-key">Clave <strong>{product.key}</strong></p>
    <div className="rx-gondola-box"><MapPin size={28}/><div><small>{planned?'LLEVAR A GÓNDOLA':'UBICACIÓN'}</small><strong>{planned?product.locations.filter(l=>!isUnplanned(l.gondola)).map(l=>l.gondola).join(' · '):'N/P'}</strong></div></div>
    {!planned&&<p className="rx-warning-text">Este producto está en la base, pero no tiene una góndola planogramada. Sepáralo para revisión antes de colocarlo.</p>}
    {product.locations.length>1&&<div className="rx-locations"><h3>Ubicaciones registradas</h3>{product.locations.map((l,i)=><p key={i}>Góndola {l.gondola||'Sin asignar'} · {l.family||'Sin familia'} · Pasillo {l.aisle||'Sin asignar'}</p>)}</div>}
    {match?.kind==='found'&&<p className="rx-match-method">{match.by==='barcode'?'Encontrado por código de barras: ':'Encontrado por código de producto: '}<b>{match.query}</b></p>}
    <details className="rx-barcodes"><summary>{product.barcodes.length} {product.barcodes.length===1?'código de barras asociado':'códigos de barras asociados'}</summary><p>Todos corresponden a este producto; pueden identificar presentaciones de empaque distintas.</p><div>{product.barcodes.map(b=><code key={b} className={match?.query===b?'rx-barcode-match':''}>{b}</code>)}</div></details>
   </section></div>
  </article>:match?.kind==='not-found'?<section className="rx-not-found" role="status"><Search size={34}/><h2>Código no encontrado en esta base</h2><strong>{match.query}</strong><p>Revisa la lectura o introduce el código de producto. No se le asignó una góndola ni se marcó como “No planogramado”.</p></section>:match?.kind==='ambiguous'?<section className="rx-alert"><AlertTriangle size={25}/><div><h2>Este código de barras apunta a más de un producto</h2><p>Confirma el código Truper impreso en el producto antes de clasificarlo.</p>{match.products.map(p=><button className="secondary" key={p.code} onClick={()=>{setQuery(p.code);lastLookup.current={query:'',at:0};lookup(p.code);}}>{p.code} · {p.description}<ArrowRight size={16}/></button>)}</div></section>:index?<div className="rx-empty"><PackageCheck size={42}/><h2>Listos para recibir</h2><p>La ubicación y la ficha aparecerán aquí al consultar un producto.</p><div><span><MapPin size={17}/> Góndola</span><span>Familia y pasillo</span><span>Fotografía de Truper</span></div></div>:null}
  </div>
  {!!recent.length&&<section className="rx-recents"><div><h3>Últimas consultas</h3><small>Consultas de esta sesión; no representan cantidades recibidas.</small></div><div className="rx-recent-grid">{recent.map(p=><button key={p.code} className="rx-recent-item" onClick={()=>{setQuery(p.code);lastLookup.current={query:'',at:0};lookup(p.code);}}><span><b>{p.code}</b><small>{p.key}</small></span><span className={!isProductPlanned(p)?'rx-recent-np':''}>{isProductPlanned(p)?'Góndola '+p.locations.filter(l=>!isUnplanned(l.gondola)).map(l=>l.gondola).join(' · '):'No planogramado'}</span></button>)}</div></section>}
  {index&&document&&<footer className="rx-base-footer"><span><CheckCircle2 size={15}/>{index.stats.products.toLocaleString('es-MX')} productos · {index.stats.barcodes.toLocaleString('es-MX')} códigos de barras</span><span title={document.filename}>Base: {baseLabel(document.filename)}</span>{!!index.stats.missingBarcodes&&<span>{index.stats.missingBarcodes} registros sin código de barras válido; sus productos se pueden consultar por código Truper.</span>}</footer>}
 </section>;
}
