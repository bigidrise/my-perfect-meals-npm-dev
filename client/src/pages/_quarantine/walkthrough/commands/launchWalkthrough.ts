import { walkthroughEngine } from "../walkthrough/WalkthroughScriptEngine";
import { getScript, hasScript } from "../walkthrough/ScriptRegistry";
import { shouldAllowAutoOpen } from "../CopilotRespectGuard";

/**
 * Phase C.1: Launch a guided walkthrough using the Script Engine
 * This is the new command that uses the WalkthroughScriptEngine
 * 
 * ⚠️ PROTECTED INVARIANT: Must respect user's coaching mode choice
 * If user chose "Do-It-Yourself" mode or disabled guided mode,
 * walkthroughs should not auto-launch.
 */
export async function launchWalkthrough(scriptId: string): Promise<void> {
  console.log(`[launchWalkthrough] Attempting to start: ${scriptId}`);
  
  // ⚠️ PROTECTED INVARIANT: Respect user's coaching mode choice
  if (!shouldAllowAutoOpen()) {
    console.log(`🛑 [launchWalkthrough] Blocked: User disabled auto-open (DIY mode or guided mode off)`);
    return;
  }
  
  if (!hasScript(scriptId)) {
    console.error(`[launchWalkthrough] Script not found: ${scriptId}`);
    return;
  }

  const script = getScript(scriptId);
  if (!script) {
    console.error(`[launchWalkthrough] Failed to get script: ${scriptId}`);
    return;
  }

  // Cancel any active walkthrough before starting a new one
  const currentState = walkthroughEngine.getState();
  if (currentState.isActive) {
    console.log(`[launchWalkthrough] Canceling active walkthrough: ${currentState.scriptId}`);
    walkthroughEngine.cancel();
    
    // Wait for engine to reach idle state
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await walkthroughEngine.start(script);
  console.log(`[launchWalkthrough] Started: ${script.title}`);
}

/**
 * Export for use in CopilotCommandRegistry
 */
export default launchWalkthrough;
