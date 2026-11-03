import {useState} from 'react';
import {ArrowUp,ArrowDown,ListOrdered} from 'lucide-react';
import type {ReactNode} from 'react';
type Item={id:string;label:string;icon:ReactNode;visible?:boolean;admin?:boolean};
export default function SidebarMenu({account,items,tab,onNavigate}:{account:string;items:Item[];tab:string;onNavigate:(id:string)=>void}){
 const key='retailhub:menu-order:'+account;
 const [editing,setEditing]=useState(false);
 const [order,setOrder]=useState<string[]>(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(saved)?[...new Set(saved.filter((id:unknown)=>typeof id==='string'))] as string[]:[];}catch{return [];}});
 const [warning,setWarning]=useState('');
 const visible=items.filter(i=>i.visible!==false);
 const arranged=[...order.map(id=>visible.find(i=>i.id===id)).filter((i):i is Item=>!!i),...visible.filter(i=>!order.includes(i.id))];
 function save(ids:string[]){setOrder(ids);try{localStorage.setItem(key,JSON.stringify(ids));setWarning('');}catch{setWarning('No se pudo guardar el orden en este navegador.');}}
 function move(id:string,delta:number){const ids=arranged.map(i=>i.id);const from=ids.indexOf(id),to=from+delta;if(from<0||to<0||to>=ids.length)return;[ids[from],ids[to]]=[ids[to],ids[from]];save([...ids,...order.filter(x=>!ids.includes(x))]);}
 return <nav aria-label="Menú principal">
  {arranged.map((i,index)=><div key={i.id}>
   {!order.length&&i.admin&&!arranged[index-1]?.admin&&<div className="workspace-label admin-label">ADMINISTRACIÓN</div>}
   <div style={{display:'flex',alignItems:'center',gap:2}}>
    <button className={'nav-item '+(tab===i.id?'active':'')} aria-current={tab===i.id?'page':undefined} onClick={()=>onNavigate(i.id)} style={{flex:1,minWidth:0}}>{i.icon}{i.label}</button>
    {editing&&<><button type="button" className="icon-btn" aria-label={'Subir '+i.label} disabled={index===0} onClick={()=>move(i.id,-1)}><ArrowUp size={15}/></button><button type="button" className="icon-btn" aria-label={'Bajar '+i.label} disabled={index===arranged.length-1} onClick={()=>move(i.id,1)}><ArrowDown size={15}/></button></>}
   </div>
  </div>)}
  <button type="button" className="nav-item" aria-pressed={editing} onClick={()=>setEditing(v=>!v)}><ListOrdered size={19}/>{editing?'Listo':'Ordenar menú'}</button>
  {editing&&<button type="button" className="nav-item" onClick={()=>save([])}>Restablecer orden</button>}
  {warning&&<p role="status">{warning}</p>}
 </nav>;
}
