import { processAssistantRequest } from "./pipeline";

// Feature flag for enhanced avatar capabilities
const ENHANCED_AVATAR_ENABLED = process.env.ENHANCED_AVATAR_ENABLED === "true";

interface EnhancedAvatarRequest {
  message: string;
  context: {
    userName?: string;
    currentPage?: string;
    streak?: number;
    badges?: number;
  };
  userId?: string;
}

interface EnhancedAvatarResponse {
  response: string;
  navigateTo?: string;
}

export async function processEnhancedAvatar(req: EnhancedAvatarRequest): Promise<EnhancedAvatarResponse> {
  if (!ENHANCED_AVATAR_ENABLED) {
    // Return signal that legacy processing should be used
    throw new Error("FALLBACK_TO_LEGACY");
  }

  try {
    // Convert the existing avatar chat format to the new pipeline format
    const pipelineRequest = {
      userId: req.userId || "anonymous",
      prompt: req.message,
      a11y: {
        plainLanguage: false, // Can be enhanced with user preferences later
        ttsRate: 1.0
      }
    };

    // Process with the enhanced pipeline
    const pipelineResponse = await processAssistantRequest(pipelineRequest);

    // Convert back to the expected avatar chat format
    return {
      response: pipelineResponse.text,
      navigateTo: pipelineResponse.navigateTo
    };

  } catch (error) {
    console.error("Enhanced avatar processing error:", error);
    // Fallback to legacy on any error
    throw new Error("FALLBACK_TO_LEGACY");
  }
}