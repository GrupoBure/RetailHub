import type {QRequest} from './quotes-core';
const aliases:Record<string,string>={cm:'cm',centimetro:'cm',centimetros:'cm',mm:'mm',milimetro:'mm',milimetros:'mm',m:'m',metro:'m',metros:'m',in:'in',inch:'in',inches:'in',pulgada:'in',pulgadas:'in',ft:'ft',pie:'ft',pies:'ft',px:'px',pixel:'px',pixeles:'px'};
const key=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\.$/,'');
export function cleanUnit(v:string){const value=v.trim();if(!value||/confirmar|pendiente|por eje/i.test(value)||/^(pza|pzas|pieza|piezas|unidad|unidades|pieces?)$/i.test(value))return '';return aliases[key(value)]||value;}
export function inlineUnit(value:string){const m=value.trim().match(/^[+-]?[\d.,]+\s*("|″|'|′|[\p{L}][\p{L}\s.\/-]*)$/u);if(!m)return '';if(/["″]/.test(m[1]))return 'in';if(/['′]/.test(m[1]))return 'ft';if(/^(aprox|aproximad|max|min)/i.test(m[1])||/^(largo|alto|ancho|total|por|x)$/i.test(m[1]))return '';return cleanUnit(m[1]);}
export function headerUnit(header:string){const bracket=header.match(/[([]\s*([^\])]+)\s*[)\]]/);if(bracket&&aliases[key(bracket[1])])return aliases[key(bracket[1])];const tail=header.trim().split(/\s+/).at(-1)||'';return aliases[key(tail)]||'';}
const stripUnit=(value:string)=>inlineUnit(value)?value.trim().replace(/\s*("|″|'|′|[\p{L}][\p{L}\s.\/-]*)$/u,'').trim():value;
export function requestAxisUnit(r:QRequest,axis:'width'|'height'){return inlineUnit(r[axis])||cleanUnit(r.unit);}
export function missingUnitAxes(r:QRequest){return (['width','height'] as const).filter(axis=>r[axis].trim()&&!requestAxisUnit(r,axis));}
export function needsRequestUnits(r:QRequest){return missingUnitAxes(r).length>0;}
export function normalizeRequestUnits(r:QRequest,widthUnit='',heightUnit=''):QRequest{
 const w=inlineUnit(r.width)||cleanUnit(widthUnit)||cleanUnit(r.unit),h=inlineUnit(r.height)||cleanUnit(heightUnit)||cleanUnit(r.unit);
 const defined=[r.width.trim()?w:null,r.height.trim()?h:null].filter(v=>v!==null) as string[];
 if(!defined.length)return {...r,unit:cleanUnit(r.unit)||''};
 if(defined.every(Boolean)&&new Set(defined).size===1)return {...r,width:stripUnit(r.width),height:stripUnit(r.height),unit:defined[0]};
 const tag=(value:string,unit:string)=>!value.trim()||!unit||inlineUnit(value)?value:value+' '+unit;
 return {...r,width:tag(r.width,w),height:tag(r.height,h),unit:defined.every(Boolean)?'Por eje':'Por confirmar'};
}
export type UnitAnswer={id:string;width?:string;height?:string};
export function resolveRequestUnits(requests:QRequest[],answers:UnitAnswer[]){const map=new Map(answers.map(a=>[a.id,a]));return requests.map(r=>{const a=map.get(r.id);if(!a)return r;const axes=missingUnitAxes(r);return normalizeRequestUnits(r,axes.includes('width')?cleanUnit(a.width||''):'',axes.includes('height')?cleanUnit(a.height||''):'');});}
export function requestMeasurements(r:QRequest){if(!r.width&&!r.height)return 'Sin medidas capturadas';const show=(axis:'width'|'height')=>{const value=r[axis]||'—',unit=requestAxisUnit(r,axis);return inlineUnit(value)||!unit?value:value+' '+unit;};return show('width')+' × '+show('height')+(needsRequestUnits(r)?' · unidad pendiente':'');}
