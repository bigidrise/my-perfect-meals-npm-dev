import { useCallback, useEffect, useRef, useState } from 'react';
type SpeechState = 'idle'|'listening'|'error'|'unsupported';
export function useSpeechToText(){
  const [state,setState]=useState<SpeechState>('idle');
  const [text,setText]=useState('');
  const recRef = useRef<any>(null);

  useEffect(()=>{
    const SpeechRec: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if(!SpeechRec){ setState('unsupported'); return; }
    const rec = new SpeechRec();
    rec.lang='en-US'; rec.continuous=true; rec.interimResults=true;
    rec.onresult=(e:any)=>{ let t=''; for(let i=e.resultIndex;i<e.results.length;i++){ t += e.results[i][0].transcript; } setText(t); };
    rec.onerror=(event:any)=>{
      console.log('Speech recognition error:', event.error);
      setState('error');
    };
    rec.onend=()=>{ if(state==='listening') setState('idle'); };
    recRef.current=rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const start=useCallback(()=>{ 
    const rec=recRef.current; 
    if(!rec){ setState('unsupported'); return; } 
    try{ 
      rec.start(); 
      setState('listening'); 
    }catch(error){ 
      console.log('Speech start error:', error);
      setState('error'); 
    }
  },[]);
  const stop=useCallback(()=>{ 
    const rec=recRef.current; 
    if(rec){ 
      try{ 
        rec.stop(); 
      }catch(error){ 
        console.log('Speech stop error:', error);
      } 
    } 
    setState('idle'); 
  },[]);
  const reset=useCallback(()=>setText(''),[]);
  return { state, text, start, stop, reset, supported: state!=='unsupported' };
}