import {useEffect,useRef,useState} from 'react';
import {FileImage} from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Keep simultaneous original downloads bounded; only render previews near the viewport.
let active=0;const waiting:Array<()=>void>=[];
async function slot(){if(active>=3)await new Promise<void>(resolve=>waiting.push(resolve));active++;return()=>{active--;waiting.shift()?.();};}
export default function GraphicThumbnail({id,revision,name,api}:{id:string;revision?:string;name:string;api:(path:string,init?:RequestInit)=>Promise<any>}){
 const host=useRef<HTMLDivElement>(null),apiRef=useRef(api);apiRef.current=api;
 const [near,setNear]=useState(false),[preview,setPreview]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'240px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!near||!(/\.(png|jpe?g|pdf)$/i.test(name)))return;
  let live=true,url='';const controller=new AbortController();setPreview('');setError(false);
  (async()=>{const release=await slot();try{
   if(!live)return;const blob:Blob=await apiRef.current('graphics/original',{method:'POST',body:JSON.stringify({id}),signal:controller.signal});if(!live)return;
   const canvas=document.createElement('canvas');
   if(/\.pdf$/i.test(name)){
    const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
    const task=pdfjs.getDocument({data:await blob.arrayBuffer(),isEvalSupported:false});
    try{const pdf=await task.promise;if(!live)return;const page=await pdf.getPage(1),normal=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(480/normal.width,320/normal.height)});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,viewport,background:'#ffffff'}).promise;}finally{await task.destroy();}
   }else{
    const bitmap=await createImageBitmap(blob);try{const scale=Math.min(480/bitmap.width,320/bitmap.height,1);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);}finally{bitmap.close();}
   }
   if(!live)return;const thumb=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!thumb)throw Error('Vista previa no disponible');if(!live)return;url=URL.createObjectURL(thumb);setPreview(url);
  }catch{if(live)setError(true);}finally{release();}})();
  return()=>{live=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[near,id,revision,name]);
 return <div ref={host} className="graphic-thumbnail">{preview?<img src={preview} alt={'Vista previa de '+name}/>:<span><FileImage size={28}/>{error?'No se pudo cargar. Abre el gráfico para reintentar.':/\.(png|jpe?g|pdf)$/i.test(name)?'Cargando vista previa…':'Abre el gráfico para descargar este formato.'}</span>}{/\.pdf$/i.test(name)&&<small>PDF · primera página</small>}</div>;
}
