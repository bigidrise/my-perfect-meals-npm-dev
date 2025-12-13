// Completion tracking to bypass guards immediately after onboarding
let JUST_FINISHED_AT = 0;

export function markJustFinished() { 
  JUST_FINISHED_AT = Date.now(); 
  console.log("🎯 Marked just finished onboarding at", JUST_FINISHED_AT);
}

export function justFinished() { 
  const withinWindow = Date.now() - JUST_FINISHED_AT < 3000;
  if (withinWindow) {
    console.log("⏰ Guard bypass active (just finished onboarding)");
  }
  return withinWindow;
}