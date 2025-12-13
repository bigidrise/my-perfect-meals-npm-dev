import React, { useContext } from 'react';
import { VoiceContext } from '@/context/VoiceContext';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, ChefHat } from 'lucide-react';
import './conversationStyles.css';

export const ConversationPanel = () => {
  const { conversationHistory, isProcessing } = useContext(VoiceContext);

  if (conversationHistory.length === 0 && !isProcessing) return null;

  return (
    <Card className="conversation-panel">
      <h3 className="conversation-header">
        <ChefHat className="w-5 h-5" />
        Chef Conversation
      </h3>
      <ScrollArea className="conversation-scroll">
        {conversationHistory.map((entry, idx) => (
          <div key={idx} className="conversation-entry">
            <div className="conversation-user">
              <div className="user-avatar">
                <User className="w-3 h-3" />
              </div>
              <span className="user-text">{entry.user}</span>
            </div>
            <div className="conversation-chef">
              <div className="chef-avatar">
                <ChefHat className="w-3 h-3" />
              </div>
              <span className="chef-text">{entry.chef}</span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="conversation-chef thinking">
            <div className="chef-avatar">
              <ChefHat className="w-3 h-3" />
            </div>
            <span className="chef-text processing">
              <Loader2 className="icon-spin" /> Thinking…
            </span>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};