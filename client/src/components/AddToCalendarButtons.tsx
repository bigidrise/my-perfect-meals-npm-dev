import { CalendarDays } from "lucide-react";
import { MPMCalendarEvent, buildGoogleCalendarUrl, buildOutlookUrl, downloadICS } from "@/lib/calendarLinks";

interface AddToCalendarButtonsProps {
  event: MPMCalendarEvent;
  accentClass?: string;
}

export default function AddToCalendarButtons({ event, accentClass = "text-white/60" }: AddToCalendarButtonsProps) {
  const pillClass =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/80 active:scale-[0.96] select-none";

  return (
    <div className="mt-2 pt-2 border-t border-white/10">
      <p className={`text-xs mb-1.5 ${accentClass}`}>Add to calendar</p>
      <div className="flex flex-wrap gap-1.5">
        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className={pillClass}
        >
          <CalendarDays className="h-3 w-3" />
          Google
        </a>
        <a
          href={buildOutlookUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className={pillClass}
        >
          <CalendarDays className="h-3 w-3" />
          Outlook
        </a>
        <button
          type="button"
          onClick={() => downloadICS(event)}
          className={pillClass}
        >
          <CalendarDays className="h-3 w-3" />
          Apple / iCal
        </button>
      </div>
    </div>
  );
}
