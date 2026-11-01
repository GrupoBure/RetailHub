export function exhibitCodeInput(value:string):{code:string;source:string|null}{
 const text=value.trim();if(!/^https?:\/\//i.test(text))return {code:value,source:null};
 let url:URL;try{url=new URL(text);}catch{throw Error('La liga de Truper no es válida.');}
 if(url.protocol!=='https:'||!['www.truper.com','truper.com'].includes(url.hostname)||url.username||url.password||url.port||!/^\/ficha_tecnica\/[^?]+\.html$/i.test(url.pathname))throw Error('Pega la liga HTML oficial de Truper.');
 const code=url.searchParams.get('code')||url.searchParams.get('codigo')||'';if(!/^\d{4,8}$/.test(code))throw Error('La liga no incluye un código. Escribe el código y pega la liga en Ficha oficial.');
 url.hash='';return {code,source:url.href};
}
