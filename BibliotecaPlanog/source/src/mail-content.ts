// Email is untrusted content. The viewer also uses a cross-origin sandbox and
// a deny-by-default CSP; no sender scripts, remote images or forms are allowed.
export function emailDocument(html:string,showImages=false,inlineImages:Record<string,string>={}){
 // Parse sender markup inside inert template content, which cannot load
 // remote resources while it is being cleaned. DOMParser sees trusted markup only.
 const doc=new DOMParser().parseFromString('<html><head></head><body></body></html>','text/html');
 const template=doc.createElement('template');template.innerHTML=html;
 const content=template.content;
 content.querySelectorAll('script,iframe,frame,object,embed,form,input,button,textarea,select,meta,base,link,svg,math,audio,video,source,template').forEach(n=>n.remove());
 content.querySelectorAll('*').forEach(node=>{
  for(const a of Array.from(node.attributes))if(/^on/i.test(a.name)||['srcdoc','action','formaction','background','srcset','ping','autofocus','name','id'].includes(a.name.toLowerCase()))node.removeAttribute(a.name);
  if(node.tagName==='IMG'){let src=node.getAttribute('src')||'';if(src.startsWith('cid:'))src=inlineImages[src.slice(4).replace(/^<|>$/g,'')]||'';if(showImages&&(/^https:\/\//i.test(src)||/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(src))){node.setAttribute('src',src);node.setAttribute('referrerpolicy','no-referrer');}else node.removeAttribute('src');node.setAttribute('alt',node.getAttribute('alt')||'Imagen no disponible');}
  if(node.hasAttribute('href')){try{const href=new URL(node.getAttribute('href')||'');if(!['https:','http:','mailto:'].includes(href.protocol))throw Error();node.setAttribute('href',href.href);node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}catch{node.removeAttribute('href');}}
 });
 const cleaned=doc.createElement('div');cleaned.appendChild(content);
 const imagePolicy=showImages?'https: data:':"'none'";
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src '+imagePolicy+'; font-src \'none\'; connect-src \'none\'; form-action \'none\'; base-uri \'none\'"><style>html{overflow-wrap:anywhere}body{margin:16px;font:14px/1.7 Arial,sans-serif;color:#17364e;background:#fff}table{max-width:100%}img{max-width:100%}pre{white-space:pre-wrap}a{color:#007b45}</style></head><body>'+cleaned.innerHTML+'</body></html>';
}
export type MailSignature={name:string;position:string;phone:string;website:string;note:string;logo:boolean};
export const blankSignature=(name=''):MailSignature=>({name,position:'',phone:'',website:'https://retailhub.mx',note:'',logo:true});
export const mailDate=(value:string|null)=>{if(!value)return '';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'';};
export const addressText=(values:any[]=[])=>values.map(v=>v.name?v.name+' <'+v.address+'>':v.address).join(', ');
