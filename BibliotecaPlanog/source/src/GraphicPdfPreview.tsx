import {useEffect,useRef,useState} from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {ChevronLeft,ChevronRight,ExternalLink,LoaderCircle} from 'lucide-react';

export default function GraphicPdfPreview({url,name}:{url:string;name:string}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[width,setWidth]=useState(480),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const node=host.current;if(!node)return;const measure=()=>setWidth(Math.max(160,Math.min(1100,Math.floor(node.clientWidth))));measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  let active=true,task:ReturnType<typeof import('pdfjs-dist')['getDocument']>|undefined;const controller=new AbortController();setPdf(null);setPage(1);setError('');setBusy(true);
  (async()=>{try{
   const [pdfjs,response]=await Promise.all([import('pdfjs-dist'),fetch(url,{signal:controller.signal})]);
   if(!response.ok)throw Error('No se pudo abrir el PDF.');const bytes=await response.arrayBuffer();if(!active)return;
   pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;task=pdfjs.getDocument({data:bytes,isEvalSupported:false});const document=await task.promise;if(active)setPdf(document);
  }catch(e){if(active){setError((e as Error).name==='PasswordException'?'Este PDF requiere contraseña. Descarga el original para abrirlo.':'No se pudo generar la vista previa. Puedes descargar el PDF original.');setBusy(false);}}})();
  return()=>{active=false;controller.abort();void task?.destroy().catch(()=>{});};
 },[url]);
 useEffect(()=>{
  if(!pdf||!canvas.current)return;let active=true,render:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;setBusy(true);setError('');const target=canvas.current;
  (async()=>{try{const sheet=await pdf.getPage(page);if(!active)return;const normal=sheet.getViewport({scale:1}),ratio=Math.min(window.devicePixelRatio||1,2),viewport=sheet.getViewport({scale:Math.min(width/normal.width,2500/normal.height)*ratio});
   target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);target.style.width='100%';target.style.height='auto';
   render=sheet.render({canvas:target,viewport,background:'#ffffff'});await render.promise;if(active)setBusy(false);
  }catch(e){if(active&&(e as Error).name!=='RenderingCancelledException'){setError('No se pudo mostrar esta página. Puedes abrir o descargar el PDF original.');setBusy(false);}}})();
  return()=>{active=false;render?.cancel();};
 },[pdf,page,width]);
 return <div ref={host} style={{minWidth:0,textAlign:'left'}} aria-label={'Vista previa de '+name}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
   <button type="button" className="secondary small" aria-label="Página anterior" disabled={!pdf||page<=1||busy} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={17}/></button>
   <span style={{fontSize:13}} aria-live="polite">{pdf?`Página ${page} de ${pdf.numPages}`:'Preparando PDF…'}</span>
   <button type="button" className="secondary small" aria-label="Página siguiente" disabled={!pdf||page>=pdf.numPages||busy} onClick={()=>setPage(n=>n+1)}><ChevronRight size={17}/></button>
   <a className="secondary small" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Abrir PDF</a>
  </div>
  {error?<p role="alert">{error}</p>:<><div style={{maxHeight:'62vh',overflow:'auto',border:'1px solid #d6e3e8',borderRadius:8,background:'#fff',minHeight:140}}><canvas ref={canvas} role="img" aria-label={`${name}, página ${page}`} style={{display:'block',maxWidth:'100%',visibility:busy?'hidden':'visible'}}/></div>{busy&&<p role="status" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><LoaderCircle size={17} className="spin"/>Cargando página…</p>}</>}
 </div>;
}
