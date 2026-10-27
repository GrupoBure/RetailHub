import {ReactNode,useId,useLayoutEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
type Props={children:ReactNode;className:string;label:string};
// The control stays above the rows, independently of the native bottom scrollbar.
export default function HorizontalScrollFrame({children,className,label}:Props){
 const viewport=useRef<HTMLDivElement>(null),id=useId();
 const [position,setPosition]=useState(0),[maximum,setMaximum]=useState(0);
 const measure=()=>{const el=viewport.current;if(!el)return;setMaximum(Math.max(0,el.scrollWidth-el.clientWidth));setPosition(el.scrollLeft);};
 useLayoutEffect(()=>{measure();const observer=new ResizeObserver(measure);const el=viewport.current;if(el){observer.observe(el);if(el.firstElementChild)observer.observe(el.firstElementChild);}return()=>observer.disconnect();},[children]);
 function move(left:number){const el=viewport.current;if(!el)return;el.scrollLeft=Math.max(0,Math.min(maximum,left));setPosition(el.scrollLeft);}
 const step=()=>Math.max(210,(viewport.current?.clientWidth||500)*.65);
 return <div className="qw-horizontal-frame"><div className="qw-horizontal-controls" role="group" aria-label={'Desplazamiento horizontal: '+label}><label htmlFor={id}>Mover columnas</label><button type="button" className="secondary small" aria-label={'Mover a la izquierda: '+label} disabled={position<=0} onClick={()=>move(position-step())}><ChevronLeft size={18}/><span>Izquierda</span></button><input id={id} type="range" min={0} max={Math.max(1,maximum)} step={1} value={Math.max(0,Math.min(maximum,position))} disabled={maximum<1} aria-label={'Barra horizontal: '+label} onChange={e=>move(Number(e.target.value))}/><button type="button" className="secondary small" aria-label={'Mover a la derecha: '+label} disabled={maximum<1||position>=maximum-1} onClick={()=>move(position+step())}><span>Derecha</span><ChevronRight size={18}/></button></div><div ref={viewport} className={className} role="region" aria-label={label} tabIndex={0} onScroll={measure}>{children}</div></div>;
}
