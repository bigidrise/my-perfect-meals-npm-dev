import { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslation } from "react-i18next";

export default function DateSlotPicker({ onChange }: { onChange: (val: { date: string; slot: string }) => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

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
          <SelectValue placeholder={t("sharedComponents.dateSlotPicker.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {slots.map(s => (
            <SelectItem key={s} value={s}>{t(`sharedComponents.mealSlots.${s}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}