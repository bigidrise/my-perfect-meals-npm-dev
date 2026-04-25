import { getDayName, formatDateShort } from "@/utils/week";

interface DayChipsProps {
  weekDates: string[];
  activeDayISO: string;
  onDayChange: (dateISO: string) => void;
}

export function DayChips({ weekDates, activeDayISO, onDayChange }: DayChipsProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none justify-center">
      {weekDates.map((dateISO) => {
        const isActive = dateISO === activeDayISO;
        const dayName = getDayName(dateISO);
        const dateShort = formatDateShort(dateISO);

        return (
          <div key={dateISO} className="inline-flex flex-col items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onDayChange(dateISO)}
              data-wt="wmb-day-button"
              className={`!min-h-0 !min-w-0 inline-flex items-center justify-center px-3 py-[2px] rounded-full text-[9px] font-semibold uppercase tracking-wide transition-transform duration-100 ease-out select-none touch-manipulation active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white border border-blue-400/50 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                  : "bg-yellow-500/20 text-white/90 border border-yellow-400/70 shadow-[0_0_6px_rgba(234,179,8,0.25)]"
              }`}
            >
              {dateShort}
            </button>
            <span className="text-[10px] font-medium text-white/50 tracking-wide">
              {dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
