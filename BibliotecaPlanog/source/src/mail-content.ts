// Email is untrusted content. The viewer also uses a cross-origin sandbox and
// a deny-by-default CSP; no sender scripts, remote images or forms are allowed.
export function emailDocument(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,iframe,frame,object,embed,form,input,button,textarea,select,meta,base,link,svg,math,audio,video,source').forEach(n=>n.remove());
 doc.querySelectorAll('*').forEach(node=>{
  for(const a of Array.from(node.attributes))if(/^on/i.test(a.name)||['srcdoc','action','formaction','background','srcset','ping','autofocus','name','id'].includes(a.name.toLowerCase()))node.removeAttribute(a.name);
  if(node.tagName==='IMG'){node.removeAttribute('src');node.setAttribute('alt',node.getAttribute('alt')||'Imagen externa bloqueada');}
  if(node.hasAttribute('href')){try{const href=new URL(node.getAttribute('href')||'');if(!['https:','http:','mailto:'].includes(href.protocol))throw Error();node.setAttribute('href',href.href);node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}catch{node.removeAttribute('href');}}
 });
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; font-src \'none\'; connect-src \'none\'; form-action \'none\'; base-uri \'none\'"><style>html{overflow-wrap:anywhere}body{margin:16px;font:14px/1.7 Arial,sans-serif;color:#17364e;background:#fff}table{max-width:100%}img{max-width:100%}pre{white-space:pre-wrap}a{color:#007b45}</style></head><body>'+doc.body.innerHTML+'</body></html>';
}
export type MailSignature={name:string;position:string;phone:string;website:string;note:string;logo:boolean};
export const blankSignature=(name=''):MailSignature=>({name,position:'',phone:'',website:'https://retailhub.mx',note:'',logo:true});
export const mailDate=(value:string|null)=>{if(!value)return '';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'';};
export const addressText=(values:any[]=[])=>values.map(v=>v.name?v.name+' <'+v.address+'>':v.address).join(', ');
