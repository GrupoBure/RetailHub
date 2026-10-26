export type PortalIdentity={id:string;name:string;username:string;role:string;enabled:boolean;store_ids?:string[];quote_view_store_ids?:string[];quote_approve_store_ids?:string[]};
const grantList=(ids:string[]|undefined)=>[...new Set(ids||[])].sort();
export function portalAccessKey(user:PortalIdentity|null){return user?JSON.stringify([user.id,user.role,user.enabled,grantList(user.store_ids),grantList(user.quote_view_store_ids),grantList(user.quote_approve_store_ids)]):'';}
export function retainPortalIdentity<T extends PortalIdentity>(current:T|null,next:T):T{return current&&portalAccessKey(current)===portalAccessKey(next)&&current.name===next.name&&current.username===next.username?current:next;}
export class PortalRequestError extends Error{constructor(message:string,public status:number){super(message);this.name='PortalRequestError';}}
export function invalidPortalSession(error:unknown){return error instanceof PortalRequestError&&(error.status===401||error.status===403);}
