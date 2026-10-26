import {useEffect,useRef,Dispatch,SetStateAction} from 'react';
import {PortalIdentity,retainPortalIdentity,invalidPortalSession} from './portal-session';
type Args<T extends PortalIdentity>={userId:string|undefined;preview:boolean;api:(path:string,init?:RequestInit,retry?:boolean)=>Promise<any>;setUser:Dispatch<SetStateAction<T|null>>;onTemporaryError:(message:string)=>void;onInvalid:()=>void};
export function useSessionRevalidation<T extends PortalIdentity>({userId,preview,api,setUser,onTemporaryError,onInvalid}:Args<T>){
 const callbacks=useRef({api,setUser,onTemporaryError,onInvalid});callbacks.current={api,setUser,onTemporaryError,onInvalid};
 useEffect(()=>{
 if(!userId||preview)return;let active=true,pending=false;
 const check=async(refresh=false)=>{
 if(pending||!active)return;pending=true;
 try{if(refresh)await callbacks.current.api('refresh',{method:'POST'},false);const result=await callbacks.current.api('me');if(active)callbacks.current.setUser(current=>current?.id===userId&&result.user.id===userId?retainPortalIdentity(current,result.user):current);}
 catch(error){if(!active)return;if(invalidPortalSession(error)){callbacks.current.onInvalid();callbacks.current.setUser(null);}else callbacks.current.onTemporaryError('No se pudo comprobar la conexión. Tu pantalla y los cambios abiertos se conservan; vuelve a intentar cuando tengas conexión.');}
 finally{pending=false;}
 };
 const visible=()=>{if(document.visibilityState==='visible')void check();};
 const timer=window.setInterval(()=>{void check(true);},45*60*1000);
 document.addEventListener('visibilitychange',visible);
 return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[userId,preview]);
}
