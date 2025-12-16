import { Button } from "@/components/ui/button";
import { startSimpleWalkthrough } from "@/components/copilot/simple-walkthrough/simpleWalkthroughHelper";

/**
 * Simple Walkthrough Demo Page
 * 
 * This page demonstrates the new simple walkthrough system
 * that works independently of voice/TTS.
 */
export default function SimpleWalkthroughDemo() {
  const handleStartWalkthrough = () => {
    startSimpleWalkthrough('demo-walkthrough', [
      {
        selector: '[data-walkthrough-demo="step-1"]',
        text: 'Welcome! This is step 1. Tap anywhere to continue.',
        showArrow: true,
      },
      {
        selector: '[data-walkthrough-demo="step-2"]',
        text: 'Great! Now look at this button. Tap to move on.',
        showArrow: true,
      },
      {
        selector: '[data-walkthrough-demo="step-3"]',
        text: 'Perfect! This is the final step. The walkthrough works!',
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple Walkthrough Demo
          </h1>
          <p className="text-white/60">
            Test the new walkthrough system that works independently of voice/TTS
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
          <div data-walkthrough-demo="step-1" className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <h2 className="text-xl font-semibold text-white mb-2">Step 1: Introduction</h2>
            <p className="text-white/70">This is the first highlighted element</p>
          </div>

          <div data-walkthrough-demo="step-2" className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl">
            <h2 className="text-xl font-semibold text-white mb-2">Step 2: Action Button</h2>
            <Button className="bg-green-600 hover:bg-green-700">
              Click Me!
            </Button>
          </div>

          <div data-walkthrough-demo="step-3" className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <h2 className="text-xl font-semibold text-white mb-2">Step 3: Completion</h2>
            <p className="text-white/70">You've completed the walkthrough!</p>
          </div>

          <div className="pt-6 border-t border-white/10">
            <Button
              onClick={handleStartWalkthrough}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 text-lg"
            >
              🎯 Start Walkthrough Demo
            </Button>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">ℹ️ How It Works</h3>
          <ul className="space-y-2 text-white/70 text-sm">
            <li>• Click the button above to start the walkthrough</li>
            <li>• Elements will be highlighted with a blue border and dim overlay</li>
            <li>• Tap anywhere on the screen to advance to the next step</li>
            <li>• No voice or TTS required - purely visual</li>
            <li>• Works completely offline</li>
            <li>• Does not interfere with Copilot voice commands</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
