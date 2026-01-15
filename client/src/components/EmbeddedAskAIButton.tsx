import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, X, Brain } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface EmbeddedAskAIButtonProps {
  context: "mens-health" | "womens-health";
  className?: string;
}

interface AIResponse {
  response: string;
  timestamp: string;
  context: string;
  conversationId: string;
}

export function EmbeddedAskAIButton({ context, className }: EmbeddedAskAIButtonProps) {
  const { user } = useAuth();
  const userId = user?.id?.toString() || "";
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    question: string;
    answer: string;
    timestamp: string;
  }>>([]);

  const contextMessage = context === "mens-health" 
    ? "Share what's on your mind about work stress, motivation, emotional challenges, or anything affecting your mental wellness. I'm here to provide personalized support for your journey."
    : "Share what's affecting your mental wellness - whether it's emotional eating, body image, stress, hormonal changes, or any challenges you're facing. I'm here to support you with understanding and practical guidance.";

  const submitMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<AIResponse> => {
      const response = await apiRequest(
        "/api/ai/mental-health-support",
        {
          method: "POST",
          body: JSON.stringify({
            message: userMessage,
            context: context === "mens-health" ? "work stress and motivation challenges" : "emotional eating and hormonal wellness",
            userId
          })
        }
      );
      return response.json();
    },
    onSuccess: (response: AIResponse) => {
      setAiResponse(response);
      setConversationHistory(prev => [...prev, {
        question: message,
        answer: response.response,
        timestamp: response.timestamp
      }]);
      setMessage(""); // Clear the input
    },
    onError: (error) => {
      console.error("Error getting AI response:", error);
      setAiResponse({
        response: "I'm experiencing some technical difficulties right now, but I want you to know that reaching out shows real strength. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        context: context,
        conversationId: ""
      });
    }
  });

  const handleSubmit = () => {
    if (message.trim()) {
      submitMutation.mutate(message.trim());
    }
  };

  const clearConversation = () => {
    setAiResponse(null);
    setConversationHistory([]);
    setMessage("");
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={`${className} bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0 shadow-lg transition-all duration-300 hover:shadow-xl`}
        size="lg"
      >
        <Brain className="mr-2 h-5 w-5" />
        Mental Health AI Support
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
              Mental Health AI Support
            </h3>
          </div>
          <div className="flex gap-2">
            {(aiResponse || conversationHistory.length > 0) && (
              <Button
                onClick={clearConversation}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-900/20"
              >
                Clear
              </Button>
            )}
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              size="sm"
              className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-900/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-purple-700 dark:text-purple-300 mb-4 leading-relaxed">
          {contextMessage}
        </p>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="max-h-80 overflow-y-auto mb-4 space-y-4">
            {conversationHistory.map((entry, index) => (
              <div key={index} className="space-y-2">
                <div className="bg-purple-100 dark:bg-purple-800/30 p-3 rounded-lg">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">You:</p>
                  <p className="text-purple-700 dark:text-purple-300">{entry.question}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-800/30 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Support:</p>
                  <p className="text-blue-700 dark:text-blue-300 whitespace-pre-wrap leading-relaxed">
                    {entry.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current AI Response */}
        {aiResponse && conversationHistory.length === 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg mb-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-start gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Personalized AI Response:
                </p>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">
                  {aiResponse.response}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share what's on your mind... I'm here to help with personalized, thoughtful support."
            className="min-h-[100px] border-purple-200 dark:border-purple-700 focus:ring-purple-500 focus:border-purple-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Press Cmd+Enter to send quickly
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || submitMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {submitMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Thinking...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Get AI Support
                </div>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-purple-600 dark:text-purple-400 text-center">
          This AI learns from our conversations to provide increasingly personalized support
        </div>
      </CardContent>
    </Card>
  );
}