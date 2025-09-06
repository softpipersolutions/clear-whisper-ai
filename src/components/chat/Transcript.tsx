import { useChatStore } from "@/store/chat";
import { User, Bot } from "lucide-react";

const Transcript = () => {
  const { messages } = useChatStore();

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Bot size={48} className="mx-auto mb-4 opacity-50" />
          <p>Start a conversation</p>
          <p className="text-sm">Type your message below to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {messages.map((message, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex-shrink-0">
            {message.role === 'user' ? (
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <User size={16} className="text-primary-foreground" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                <Bot size={16} className="text-secondary-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-1">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {message.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Transcript;