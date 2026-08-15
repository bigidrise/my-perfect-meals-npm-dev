// Example Chef component that uses the new navigation system
import React, { useState } from 'react';
import { useChefNavigation, navigateByVoiceImperative } from './chefNavigator';

export default function ChefNavigationExample() {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const navigateByVoice = useChefNavigation();

  // Voice/chat command handler
  function handleCommand(cmd: string) {
    // Detect simple nav intents
    // Examples: "take me to kids meals", "open shopping list", "go to weekly plan"
    const cleaned = cmd
      .toLowerCase()
      .replace(/^.*?(take me to|open|go to|navigate to|show me)\s+/,'')
      .trim();

    const result = navigateByVoice(cleaned);
    setMessage(result.message || 'Navigation attempted');
    
    if (result.ok) {
      console.log(`✅ Chef navigated to: ${result.feature?.displayName}`);
    } else {
      console.log(`❌ Chef navigation failed: ${result.message}`);
    }
  }

  return (
    <div className="chef-navigation-example p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-3">🧑‍🍳 Chef Navigation Test</h3>
      <form onSubmit={(e) => { 
        e.preventDefault(); 
        handleCommand(input); 
        setInput('');
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Try: 'take me to kids meals' or 'open ai meal creator'"
          className="border rounded px-3 py-2 w-full mb-2"
        />
        <button 
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Ask Chef
        </button>
      </form>
      {message && (
        <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
          Chef says: {message}
        </div>
      )}
    </div>
  );
}

// Alternative imperative example (for use outside React components)
export function testChefNavigationImperative(query: string) {
  const result = navigateByVoiceImperative(query);
  
  if (result.ok) {
    console.log(`✅ Chef found: ${result.feature?.displayName} → ${result.path}`);
    // In a real app, you'd use this path with your router
    // For example: window.location.href = result.path;
  } else {
    console.log(`❌ Chef couldn't find: ${result.message}`);
  }
  
  return result;
}