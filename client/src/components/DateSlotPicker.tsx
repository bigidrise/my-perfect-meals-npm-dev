import { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function DateSlotPicker({ onChange }: { onChange: (val: { date: string; slot: string }) => void }) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];

  function emit(d = date, s = slot) {
    onChange({ date: d, slot: s });
  }

  return (
    <div className="space-y-2">
      <Input 
        type="date" 
        value={date} 
        onChange={(e) => { 
          setDate(e.target.value); 
          emit(e.target.value, slot); 
        }} 
      />
      <Select value={slot} onValueChange={(v) => { 
        setSlot(v); 
        emit(date, v); 
      }}>
        <SelectTrigger>
          <SelectValue placeholder="Select meal slot" />
        </SelectTrigger>
        <SelectContent>
          {slots.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}