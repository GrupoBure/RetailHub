export const EXHIBIT_FAMILIES=['Placas, apagadores y contactos','Luminarias','Grifería','Regaderas','Cerrajería','Otros'];
export function exhibitFamily(exhibit:{name:string;family?:string}):string{
 const explicit=exhibit.family?.trim();if(explicit)return explicit;
 const name=exhibit.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/placas?|apagador|interruptor|contactos?|volteck.*(?:classic|italiana|oslo|blanco|espanola)|lisboa/.test(name))return EXHIBIT_FAMILIES[0];
 if(/luminaria|luminario|iluminacion|plafon|reflector|lampara|focos?/.test(name))return 'Luminarias';
 if(/griferia|grifos?|mezclador|llaves?/.test(name))return 'Grifería';
 if(/regadera|ducha/.test(name))return 'Regaderas';
 if(/cerrajeria|cerradura|candados?|cerrojos?/.test(name))return 'Cerrajería';
 return 'Otros';
}
