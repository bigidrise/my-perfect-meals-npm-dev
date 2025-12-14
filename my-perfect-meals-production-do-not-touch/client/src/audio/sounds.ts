export type SoundKey =
  | "music"
  | "correct"
  | "wrong"
  | "streak"
  | "roundWin"
  | "finalFanfare";

export const SOUND_URLS: Record<SoundKey, string> = {
  music: "/sounds/music-loop.mp3",
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  streak: "/sounds/streak.mp3",
  roundWin: "/sounds/round-win.mp3",
  finalFanfare: "/sounds/final-fanfare.mp3",
};
