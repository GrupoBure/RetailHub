// Poll only active pages, coalesce events, and recheck immediately after returning online.
export function startDocumentWatch(check:()=>Promise<void>,onError:(e:unknown)=>void,interval=20000){
 let stopped=false,running=false;
 const run=async()=>{if(stopped||running||document.visibilityState==='hidden'||navigator.onLine===false)return;running=true;try{await check();}catch(e){if(!stopped)onError(e);}finally{running=false;}};
 const visible=()=>{if(document.visibilityState!=='hidden')void run();};
 const timer=window.setInterval(run,interval);window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);window.addEventListener('rh-documents-changed',visible);
 const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('rh-documents'):null;if(channel)channel.onmessage=visible;
 return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);window.removeEventListener('rh-documents-changed',visible);channel?.close();};
}
export function announceDocumentChange(){window.dispatchEvent(new Event('rh-documents-changed'));if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('rh-documents');channel.postMessage('changed');channel.close();}}
