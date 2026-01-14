export interface DetectedTimer {
  seconds: number;
  label: string;
  instructionIndex: number;
}

export function extractTimerSeconds(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:–|-|to)?\s*\d*\s*(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (isNaN(value)) return null;

  const unit = match[2].toLowerCase();
  
  if (unit.startsWith('hour') || unit.startsWith('hr')) {
    return value * 3600;
  } else if (unit.startsWith('min')) {
    return value * 60;
  } else if (unit.startsWith('sec')) {
    return value;
  }
  
  return null;
}

export function extractTimersFromInstructions(instructions: string[] | string): DetectedTimer[] {
  const instructionArray = Array.isArray(instructions) ? instructions : [instructions];
  const timers: DetectedTimer[] = [];
  
  instructionArray.forEach((instruction, index) => {
    const seconds = extractTimerSeconds(instruction);
    if (seconds !== null && seconds > 0) {
      const minutes = Math.round(seconds / 60);
      timers.push({
        seconds,
        label: minutes >= 60 
          ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
          : `${minutes} min`,
        instructionIndex: index,
      });
    }
  });
  
  return timers;
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0:00";
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
