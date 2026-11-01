// Shared by browser uploads and the standalone Edge Function.
export const EXHIBIT_IMAGE_LIMIT=10000000;
export class ExhibitImageError extends Error{constructor(message:string,public status=400){super(message);}}
export function decodeExhibitImage(dataUrl:string){
 if(typeof dataUrl!=='string')throw new ExhibitImageError('Selecciona una imagen JPG, PNG o WebP.');
 const header=dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,/);if(!header)throw new ExhibitImageError('Selecciona una imagen JPG, PNG o WebP.');
 const encoded=dataUrl.slice(header[0].length);if(encoded.length>Math.ceil(EXHIBIT_IMAGE_LIMIT/3)*4)throw new ExhibitImageError('La imagen supera 10 MB.',413);
 let binary:string;try{binary=atob(encoded);}catch{throw new ExhibitImageError('No se pudo leer el contenido de la imagen.');}
 if(binary.length>EXHIBIT_IMAGE_LIMIT)throw new ExhibitImageError('La imagen supera 10 MB.',413);
 // Do not use Uint8Array.from(string, callback): it creates a large intermediate list.
 const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return {mime:header[1],bytes};
}
export function checkExhibitImage(mime:string,bytes:Uint8Array){
 if(bytes.length>EXHIBIT_IMAGE_LIMIT)throw new ExhibitImageError('La imagen supera 10 MB.',413);
 const good=mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):mime==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!good)throw new ExhibitImageError('El contenido no corresponde al formato de imagen.');
}
export function exhibitImageRequest(dataUrl:string,binary:boolean,original?:Blob):RequestInit{
 if(!binary)return {method:'POST',body:JSON.stringify({dataUrl})};
 if(original){if(original.size>EXHIBIT_IMAGE_LIMIT)throw new ExhibitImageError('La imagen supera 10 MB.',413);if(!/^image\/(jpeg|png|webp)$/.test(original.type))throw new ExhibitImageError('Selecciona una imagen JPG, PNG o WebP.');return {method:'POST',headers:{'Content-Type':original.type},body:original};}
 const {mime,bytes}=decodeExhibitImage(dataUrl);checkExhibitImage(mime,bytes);return {method:'POST',headers:{'Content-Type':mime},body:new Blob([bytes],{type:mime})};
}
