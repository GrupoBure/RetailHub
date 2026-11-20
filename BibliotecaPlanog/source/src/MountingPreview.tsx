import MountingPie from './MountingPie';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Printer,X} from 'lucide-react';
import {MOUNT_COLORS,MOUNT_STAGES} from './mounting-model';
import type {MountData} from './mounting-model';
const printStyles = `
 * { box-sizing: border-box; }
 html, body { margin: 0; padding: 0; }
 body { color: #17272f; font: 9pt Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
 .mt-print-paper { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 2mm; }
 .mt-print-paper.has-warning { grid-template-rows: auto auto auto minmax(0, 1fr) auto; }
 .mt-print-heading { display: flex; justify-content: space-between; align-items: center; gap: 4mm; }
 .mt-print-heading > div:first-child { min-width: 0; overflow-wrap: anywhere; }
 .mt-print-heading b { font-size: 8pt; color: #126347; }
 .mt-print-heading h1 { font-size: 15pt; margin: 1mm 0; }
 .mt-print-heading p, .mt-print-warning { margin: 0; }
 .mt-print-progress { display: flex; align-items: center; gap: 2mm; flex-shrink: 0; }
 .mt-print-progress strong { display: block; font-size: 16pt; }
 .mt-print-progress span { display: block; }
 .mt-pie { margin: 0; text-align: center; }
 .mt-pie svg { display: block; width: 14mm; height: 14mm; }
 .mt-pie-total { font-size: 20px; font-weight: bold; }
 .mt-pie-label { font-size: 10px; }
 .mt-pie figcaption { display: none; }
 .mt-print-legend { display: flex; flex-wrap: wrap; gap: 1mm 4mm; font-size: 8pt; }
 .mt-print-legend span { display: inline-flex; align-items: center; gap: 1mm; }
 .mt-print-legend i { width: 2.5mm; height: 2.5mm; border-radius: 0.5mm; }
 .mt-print-warning { font-size: 8pt; color: #7a4900; }
 .mt-print-fit { display: grid; place-items: center; min-width: 0; min-height: 0; }
 .mt-print-plan { position: relative; }
 .mt-print-plan img { display: block; width: 100%; height: 100%; }
 .mt-print-zone { position: absolute; display: grid; place-items: center; border: 0.25mm solid; }
 .mt-print-zone span { background: #fff; color: #17272f; font: bold 6pt/1 Arial, sans-serif; padding: 0.15mm; white-space: nowrap; }
 .mt-print-vertical span { writing-mode: vertical-rl; }
 .mt-print-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1mm 4mm; color: #374955; font-size: 7pt; }
`;

async function printMountingPreview(paper: HTMLElement, source: HTMLImageElement) {
 const frame = document.createElement('iframe');
 frame.title = 'Impresión del avance de montaje';
 frame.setAttribute('aria-hidden', 'true');
 frame.tabIndex = -1;
 frame.style.cssText = 'position:fixed;left:-2000px;top:0;width:320mm;height:240mm;border:0';
 document.body.append(frame);
 try {
  const page = frame.contentDocument;
  const target = frame.contentWindow;
  if (!page || !target) throw new Error('No se pudo preparar la hoja de impresión.');
  const landscape = source.naturalWidth >= source.naturalHeight;
  // Letter dimensions minus the 8 mm margins, with 1 mm of rounding clearance.
  const width = landscape ? 262 : 198;
  const height = landscape ? 198 : 262;
  page.documentElement.lang = 'es-MX';
  page.title = paper.querySelector('h1')?.textContent || 'Avance de montaje';
  const style = page.createElement('style');
  style.textContent = printStyles + `@page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; }
   .mt-print-paper { width: ${width}mm; height: ${height}mm; }`;
  page.head.append(style);
  const copy = page.importNode(paper, true);
  if (copy.querySelector('.mt-print-warning')) copy.classList.add('has-warning');
  const plan = copy.querySelector<HTMLElement>('.mt-print-plan');
  const image = plan?.querySelector('img');
  if (!plan || !image) throw new Error('No se encontró la imagen del plano.');
  const fit = page.createElement('div');
  fit.className = 'mt-print-fit';
  plan.replaceWith(fit);
  fit.append(plan);
  page.body.append(copy);
  await image.decode();
  const ratio = source.naturalWidth / source.naturalHeight;
  const planWidth = Math.min(fit.clientWidth, fit.clientHeight * ratio);
  plan.style.width = planWidth + 'px';
  plan.style.height = planWidth / ratio + 'px';
  target.addEventListener('afterprint', () => frame.remove(), {once: true});
  target.focus();
  target.print();
 } catch (error) {
  frame.remove();
  throw error;
 }
}

export default function MountingPreview({data,image,store,dirty,onClose}:{data:MountData;image:string;store:string;dirty:boolean;onClose:()=>void}){
 const [ready,setReady]=useState(false);
 const paper=useRef<HTMLElement>(null),planImage=useRef<HTMLImageElement>(null);
 const [printing,setPrinting]=useState(false),[printError,setPrintError]=useState('');
 async function print(){
  if(!paper.current||!planImage.current?.naturalWidth)return;
  setPrinting(true);setPrintError('');
  try{await printMountingPreview(paper.current,planImage.current);}
  catch{setPrintError('No se pudo preparar el plano para imprimir. Vuelve a intentarlo.');}
  finally{setPrinting(false);}
 }
 const close=useRef<HTMLButtonElement>(null);
 const total=data.zones.length,percent=total?Math.round(data.zones.reduce((n,z)=>n+z.stage,0)/(total*3)*100):0;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};const before=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',key);return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',key);previous?.focus();};},[]);
 return createPortal(<div className="mt-preview-overlay" role="dialog" aria-modal="true" aria-label="Vista previa del avance de montaje"><div className="mt-preview-shell"><div className="mt-preview-actions"><div><b>Vista previa del montaje</b><span>Imprime o selecciona «Guardar como PDF» en la ventana de impresión.</span></div><button className="primary" disabled={!image||!ready||printing} onClick={()=>void print()}><Printer size={17}/>Imprimir / guardar PDF</button><button ref={close} className="icon-btn" aria-label="Cerrar vista previa" onClick={onClose}><X size={21}/></button></div>{printError&&<p role="alert">{printError}</p>}<article ref={paper} className="mt-print-paper"><header className="mt-print-heading"><div><b>RETAIL HUB · AVANCE DE MONTAJE</b><h1>{store}</h1><p>{data.name}</p></div><div className="mt-print-progress"><MountingPie zones={data.zones}/><div><strong>{percent}%</strong><span>Avance general</span><span>{data.zones.filter(z=>z.stage===3).length} / {total} completas</span></div></div></header><div className="mt-print-legend">{MOUNT_STAGES.map((stage,i)=><span key={stage}><i style={{background:MOUNT_COLORS[i]}}/>{stage}: {data.zones.filter(z=>z.stage===i).length} góndolas</span>)}</div>{dirty&&<p className="mt-print-warning">Vista previa con cambios sin guardar.</p>}<div className="mt-print-plan"><img ref={planImage} src={image} onLoad={()=>setReady(true)} alt="Plano de montaje con el avance por góndola"/>{data.zones.map(z=><div key={z.id} className={'mt-print-zone '+(z.h>z.w?'mt-print-vertical':'')} style={{left:z.x*100+'%',top:z.y*100+'%',width:z.w*100+'%',height:z.h*100+'%',borderColor:MOUNT_COLORS[z.stage],background:MOUNT_COLORS[z.stage]+'88'}}><span>{z.number} · {Math.round(z.stage/3*100)}%</span></div>)}</div><footer className="mt-print-foot"><span>{new Date().toLocaleString('es-MX')}</span><span>Góndola · porcentaje | Accesorios, producto y precios: una tercera parte cada etapa.</span></footer></article></div></div>,document.body);
}
