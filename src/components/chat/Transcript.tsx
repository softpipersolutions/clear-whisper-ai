import { useConversationsStore } from "@/store/conversations";
import { useChatStore } from "@/store/chat";
import { User, Bot, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import VisuallyHidden from "@/components/common/VisuallyHidden";
import { LoadingAnimation } from "./LoadingAnimation";
import { MessageCostDisplay } from "./MessageCostDisplay";

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
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  const chatMessages = activeChatId ? messagesByChat[activeChatId] : null;
  const messages = chatMessages?.items || [];
  const hasMoreMessages = chatMessages?.nextCursor !== undefined;
  const isLoadingMore = chatMessages?.loading || false;

  // Check if user has scrolled and manage auto-scroll behavior
  const handleScroll = useCallback((e: React.UIEvent) => {
    const target = e.target as HTMLElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // Calculate how far from bottom (as percentage)
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const scrollPercentage = (distanceFromBottom / scrollHeight) * 100;
    
    // Show load more button when near top
    setShowLoadMore(scrollTop < 100 && hasMoreMessages);
    
    // Show jump to bottom when user has scrolled up >10%
    const shouldShowJump = scrollPercentage > 10;
    setShowJumpToBottom(shouldShowJump);
    setUserHasScrolled(shouldShowJump);
  }, [hasMoreMessages]);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    const newMessageCount = messages.length + (streamingMessage ? 1 : 0);
    const hasNewContent = newMessageCount > lastMessageCount;
    
    if (hasNewContent && !userHasScrolled && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
    
    setLastMessageCount(newMessageCount);
  }, [messages.length, streamingMessage, userHasScrolled, lastMessageCount]);

  const handleLoadMore = () => {
    if (activeChatId && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages(activeChatId);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
        setUserHasScrolled(false);
        setShowJumpToBottom(false);
      }
    }
  }, []);

  // Handle keyboard navigation for jump to bottom button
  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToBottom();
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
      {/* Accessibility: Live region for screen readers */}
      <div 
        aria-live="polite" 
        aria-label="Chat conversation"
        className="h-full"
      >
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
                  className="h-8 focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  aria-label={isLoadingMore ? 'Loading earlier messages' : 'Load earlier messages in conversation'}
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
                  role="article"
                  aria-label={`${message.role === 'user' ? 'Your' : 'Assistant'} message`}
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
                       <div className="text-xs text-muted-foreground mt-1" aria-label="Token usage">
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
                  role="article"
                  aria-label="Assistant is responding"
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

              {/* Loading state when waiting for response */}
              {phase === 'executing' && !isStreaming && !streamingMessage && (
                <LoadingAnimation message="AI is thinking..." />
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      {/* Accessibility: Screen reader announcement for typing status */}
      {isStreaming && (
        <VisuallyHidden>
          <div aria-live="polite" aria-atomic="true">
            Assistant is typing...
          </div>
        </VisuallyHidden>
      )}

      {/* Jump to newest message pill */}
      <AnimatePresence>
        {showJumpToBottom && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"
          >
            <Button
              onClick={scrollToBottom}
              onKeyDown={handleJumpKeyDown}
              variant="secondary"
              size="sm"
              className="shadow-lg focus:ring-2 focus:ring-accent focus:ring-offset-2 bg-background/95 backdrop-blur-sm border border-border/50 hover:bg-accent/90"
              aria-label="Jump to newest message in conversation"
              tabIndex={0}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Jump to newest
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Transcript;