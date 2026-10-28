// Presence is independent of interaction. Never capture keys or field contents.
export function startPresence(api:(path:string,init?:RequestInit)=>Promise<any>){
 let lastInput=0,lastPulse=-Infinity,pending=false,stopped=false;
 const pulse=async()=>{if(stopped||pending||Date.now()-lastPulse<25000)return;pending=true;lastPulse=Date.now();try{await api('activity/heartbeat',{method:'POST',body:JSON.stringify({active:document.visibilityState==='visible'&&document.hasFocus()&&lastInput>0&&Date.now()-lastInput<90000})});}catch{}finally{pending=false;}};
 const input=()=>{lastInput=Date.now();void pulse();};
 const resume=()=>{void pulse();};
 const events=['pointerdown','pointermove','keydown','wheel','touchstart'];
 for(const name of events)window.addEventListener(name,input,{passive:true});
 window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
 void pulse();const timer=window.setInterval(pulse,30000);
 return()=>{stopped=true;clearInterval(timer);for(const name of events)window.removeEventListener(name,input);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
}
