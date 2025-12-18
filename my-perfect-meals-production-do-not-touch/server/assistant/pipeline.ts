import { classify, parseAddToList, parseNavigation } from "./intent";
import { retrieve } from "./rag";
import { Tools, validateToolCall } from "./tools";
// Node.js has fetch built-in from v18+

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini"; // Fast and capable

interface AssistantRequest {
  userId: string;
  prompt: string;
  a11y?: {
    plainLanguage?: boolean;
    ttsRate?: number;
  };
}

interface AssistantResponse {
  text: string;
  captions: string;
  navigateTo?: string;
}

async function fetchAvatarContext(userId: string) {
  try {
    const response = await fetch(`http://localhost:5000/api/avatar/context`, {
      headers: { 'x-user-id': userId },
    });
    return response.ok ? response.json() : {};
  } catch {
    return {};
  }
}

export async function processAssistantRequest(req: AssistantRequest): Promise<AssistantResponse> {
  const { userId, prompt, a11y = {} } = req;
  
  if (!prompt?.trim()) {
    return {
      text: "Ask me anything about nutrition, fitness, mindset, or navigating the app!",
      captions: "Ask me anything about nutrition, fitness, mindset, or navigating the app!"
    };
  }

  // Fetch user context for intelligent responses
  const context = await fetchAvatarContext(userId);

  // Check for meal-related queries with context
  if (prompt.toLowerCase().includes("dinner") || prompt.toLowerCase().includes("what's for")) {
    const todaysMeals = context.today?.instances || context.today?.planName || "No meals planned";
    return {
      text: `Today's plan: ${JSON.stringify(todaysMeals)}. Would you like me to suggest something?`,
      captions: `Today's plan: ${JSON.stringify(todaysMeals)}. Would you like me to suggest something?`
    };
  }

  // 1) Safety check
  const intent = classify(prompt);
  if (intent === "BLOCKED") {
    return {
      text: "This sounds potentially urgent. I can't help with medical issues - please seek professional care or call emergency services if you're in danger.",
      captions: "This sounds potentially urgent. I can't help with medical issues - please seek professional care or call emergency services if you're in danger."
    };
  }

  // 2) Handle direct actions and navigation
  let toolResponses: any[] = [];
  let navigateTo: string | undefined;

  // Navigation
  if (intent === "NAVIGATE") {
    const route = parseNavigation(prompt);
    if (route) {
      if (route === "/fitbrain-rush") {
        const toolResult = await Tools.openFitBrainRush();
        navigateTo = toolResult.navigateTo;
        toolResponses.push({ name: "openFitBrainRush", result: toolResult });
      } else if (route === "help:anti-inflammatory") {
        const toolResult = await Tools.showAntiInflammatoryHelp();
        toolResponses.push({ name: "showAntiInflammatoryHelp", result: toolResult });
      } else {
        const toolResult = await Tools.navigate(userId, route);
        navigateTo = toolResult.navigateTo;
        toolResponses.push({ name: "navigate", result: toolResult });
      }
    }
  }

  // Actions
  if (intent === "DO") {
    const addToListParsed = parseAddToList(prompt);
    if (addToListParsed) {
      try {
        validateToolCall("addToShoppingList", addToListParsed);
        const toolResult = await Tools.addToShoppingList(userId, addToListParsed.item, addToListParsed.qty, addToListParsed.unit);
        toolResponses.push({ name: "addToShoppingList", result: toolResult });
      } catch (e) {
        toolResponses.push({ name: "addToShoppingList", result: { ok: false, message: "Could not add to shopping list" } });
      }
    }
  }

  // Pre-fetch data for health questions
  if (intent === "QNA_HEALTH") {
    if (/(protein|grams)/i.test(prompt)) {
      const toolResult = await Tools.estimateProteinTarget(userId);
      toolResponses.push({ name: "estimateProteinTarget", result: toolResult });
    }
    
    if (/challenge/i.test(prompt)) {
      const toolResult = await Tools.getDailyChallenge(userId);
      toolResponses.push({ name: "getDailyChallenge", result: toolResult });
    }
  }

  // 3) Get relevant knowledge
  const relevantDocs = retrieve(prompt, 3);
  const contextBlocks = relevantDocs.map(doc => `# ${doc.title}\n${doc.text}`).join("\n\n");

  // 4) Build conversation context
  const systemPrompt = [
    "You are the Avatar concierge inside the My Perfect Meals app.",
    "Your role: help users navigate the app, perform actions, and provide practical health guidance.",
    "Style: Be concise, encouraging, and supportive.",
    a11y.plainLanguage ? "Use simple language and short sentences." : "Use clear, natural language.",
    "For health answers: provide practical advice with brief rationale and one actionable step.",
    "Always include: 'Educational, not medical advice.'",
    "Never diagnose medical conditions. For emergencies or severe symptoms, advise seeking professional care.",
    "If tools were called, acknowledge the action briefly.",
  ].join(" ");

  const toolSummary = toolResponses.length > 0
    ? "Tool results:\n" + toolResponses.map(t => `- ${t.name}: ${JSON.stringify(t.result)}`).join("\n")
    : "No tools called.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
    { role: "system", content: `Relevant information:\n${contextBlocks}` },
    { role: "system", content: toolSummary }
  ];

  // 5) Generate response
  let responseText = "";
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: a11y.plainLanguage ? 0.2 : 0.5,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    responseText = data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("Assistant pipeline error:", error);
    responseText = "I'm having trouble connecting right now. Please try again in a moment.";
  }

  // 6) Return formatted response with any client events
  const finalText = responseText || "Done.";
  const clientEvent = toolResponses.find(t => t.result?.clientEvent)?.result?.clientEvent;
  
  return {
    text: finalText,
    captions: finalText,
    navigateTo: navigateTo,
    clientEvent: clientEvent
  };
}