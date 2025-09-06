import { useConversationsStore } from "@/store/conversations";
import { useChatStore } from "@/store/chat";
import { User, Bot, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const TypewriterText = ({ text, isComplete }: { text: string; isComplete: boolean }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 25); // 25ms per character for typewriter effect
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text]);

  useEffect(() => {
    // Reset when text changes (new message)
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span>
      {displayText}
      {!isComplete && currentIndex < text.length && (
        <span className="animate-cursor-blink ml-0.5">|</span>
      )}
    </span>
  );
};

const Transcript = () => {
  const { 
    activeChatId, 
    messagesByChat, 
    streamingMessage, 
    isStreaming,
    loadMoreMessages 
  } = useConversationsStore();
  const { phase } = useChatStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showLoadMore, setShowLoadMore] = useState(false);

  const chatMessages = activeChatId ? messagesByChat[activeChatId] : null;
  const messages = chatMessages?.items || [];
  const hasMoreMessages = chatMessages?.nextCursor !== undefined;
  const isLoadingMore = chatMessages?.loading || false;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages.length, streamingMessage]);

  // Check if user has scrolled up to show load more button
  const handleScroll = (e: React.UIEvent) => {
    const target = e.target as HTMLElement;
    const scrollTop = target.scrollTop;
    setShowLoadMore(scrollTop < 100 && hasMoreMessages);
  };

  const handleLoadMore = () => {
    if (activeChatId && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages(activeChatId);
    }
  };

  if (!activeChatId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Bot size={48} className="mx-auto mb-4 opacity-50" />
          <p>Welcome to ClearChat</p>
          <p className="text-sm">Select a chat or start a new conversation</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
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
    <div className="h-full relative">
      <ScrollArea ref={scrollAreaRef} className="h-full" onScrollCapture={handleScroll}>
        <div className="p-4 space-y-4">
          {/* Load more button */}
          {showLoadMore && (
            <div className="flex justify-center mb-4">
              <Button
                onClick={handleLoadMore}
                variant="outline"
                size="sm"
                disabled={isLoadingMore}
                className="h-8"
              >
                <ChevronUp className="h-4 w-4 mr-2" />
                {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
              </Button>
            </div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div 
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0">
                  {message.role === 'user' ? (
                    <div className="w-8 h-8 bg-brown rounded-full flex items-center justify-center shadow-brand">
                      <User size={16} className="text-brown-foreground" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-brand">
                      <Bot size={16} className="text-accent-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1 text-muted-foreground">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {(message.tokensIn > 0 || message.tokensOut > 0) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {message.tokensIn > 0 && `${message.tokensIn} tokens in`}
                      {message.tokensIn > 0 && message.tokensOut > 0 && ' • '}
                      {message.tokensOut > 0 && `${message.tokensOut} tokens out`}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Streaming message */}
            {isStreaming && streamingMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-brand">
                    <Bot size={16} className="text-accent-foreground" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1 text-muted-foreground">
                    Assistant
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    <TypewriterText text={streamingMessage} isComplete={phase !== 'executing'} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Transcript;