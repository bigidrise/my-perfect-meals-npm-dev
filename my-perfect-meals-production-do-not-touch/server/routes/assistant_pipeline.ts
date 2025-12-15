import type { Request, Response } from "express";
import { processAssistantRequest } from "../assistant/pipeline";

/**
 * Modern Avatar Assistant Pipeline
 * - Knows the app (navigation & actions)
 * - Can answer nutrition, fitness, and mindset questions with RAG
 * - Can provide smart tool-based responses
 * - Full accessibility: captions always returned, voice optional
 * - Returns exact same format as legacy for backward compatibility
 */
export default async function modernAssistant(req: Request, res: Response) {
  try {
    const { message, context, a11y } = req.body;
    const userId = context?.userId || "anonymous";

    if (!message) {
      const fallbackText = "Ask me anything about nutrition, fitness, mindset, or navigating the app!";
      return {
        text: fallbackText,
        captions: fallbackText,
        navigateTo: undefined
      };
    }

    // Process with the enhanced pipeline
    const pipelineResponse = await processAssistantRequest({
      userId,
      prompt: message,
      a11y: a11y || {
        plainLanguage: false,
        ttsRate: 1.0
      }
    });

    // Return the pipeline response directly (not res.json)
    return {
      text: pipelineResponse.text,
      captions: pipelineResponse.captions || pipelineResponse.text,
      navigateTo: pipelineResponse.navigateTo
    };

  } catch (error) {
    console.error("Modern assistant pipeline error:", error);
    throw error; // Let the wrapper handle fallback
  }
}