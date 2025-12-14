import React, { useMemo, useState } from 'react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { parseMultiLineToItems } from '@/utils/shoppingPad/parse';
import { shoppingPadHref } from '@/utils/shoppingPad/link';
import { mergeItems } from '@/utils/shoppingPad/merge';
import { categorize } from '@/utils/shoppingPad/categorize';
import type { ShoppingItem } from '@/utils/shoppingPad/types';
import { useLocation } from 'wouter';

export default function VoiceToShoppingPadButton({ seedItems }:{ seedItems?: ShoppingItem[] }){
  const [, setLocation] = useLocation();
  const { state, text, start, stop, reset, supported } = useSpeechToText();
  const [editable, setEditable] = useState<ShoppingItem[]>([]);

  const parsed = useMemo(()=>{
    const arr = parseMultiLineToItems(text || '');
    return mergeItems(arr.map(it=> ({...it, category: it.category ?? categorize(it.name)} )));
  },[text]);

  function beginEdit(){
    setEditable(parsed.map(p=>({...p})));
  }

  function send(){
    const combined = mergeItems([...(seedItems ?? []), ...editable]);
    const href = shoppingPadHref(combined);
    setLocation(href);
  }

  if(!supported){
    return <button className="px-3 py-2 border rounded-xl" onClick={()=>alert('Voice not supported on this device.')} >🎙️ Voice to List</button>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {state!=='listening'
          ? <button className="px-3 py-2 border rounded-xl" onClick={start}>🎙️ Start</button>
          : <button className="px-3 py-2 border rounded-xl" onClick={stop}>■ Stop</button>}
        <button className="px-3 py-2 border rounded-xl" onClick={reset} disabled={!text}>Clear</button>
        <button className="px-3 py-2 border rounded-xl" onClick={beginEdit} disabled={!parsed.length}>Review</button>
      </div>

      {!!editable.length && (
        <div className="p-2 border rounded-xl">
          <div className="text-sm mb-2">Quick edit before sending:</div>
          {editable.map((it, idx)=>(
            <div key={it.id} className="flex gap-2 mb-2">
              <input className="border rounded px-2 py-1 w-40" value={it.name} onChange={e=>setEditable(prev=>prev.map((p,i)=>i===idx?{...p,name:e.target.value}:p))}/>
              <input className="border rounded px-2 py-1 w-16" value={it.qty ?? ''} onChange={e=>setEditable(prev=>prev.map((p,i)=>i===idx?{...p,qty:e.target.value?Number(e.target.value):undefined}:p))} placeholder="qty"/>
              <input className="border rounded px-2 py-1 w-20" value={it.unit ?? ''} onChange={e=>setEditable(prev=>prev.map((p,i)=>i===idx?{...p,unit:e.target.value}:p))} placeholder="unit"/>
              <button className="text-red-600 underline" onClick={()=>setEditable(prev=>prev.filter((_,i)=>i!==idx))}>delete</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="px-3 py-2 border rounded-xl" onClick={()=>setEditable([])}>Cancel</button>
            <button className="px-3 py-2 border rounded-xl" onClick={send}>Send to Shopping Pad</button>
          </div>
        </div>
      )}
    </div>
  );
}