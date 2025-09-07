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
import { useModelsStore } from "@/store/models";

const StreamingText = ({ text, isStreaming }: { text: string; isStreaming: boolean }) => {
  return (
    <span>
      {text}
      {isStreaming && (
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
    isStreaming: conversationStreaming,
    loadMoreMessages
  } = useConversationsStore();
  const { models } = useModelsStore();
  const { isStreaming: chatStreaming, stopStream, phase } = useChatStore();
  
  // Unified streaming state
  const isStreaming = conversationStreaming || chatStreaming;
  
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
    
    const isNearTop = scrollTop < 100;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    
    setShowLoadMore(isNearTop && hasMoreMessages);
    setShowJumpToBottom(!isAtBottom && messages.length > 0);
    
    if (scrollTop > 100) {
      setUserHasScrolled(true);
    }
  }, [hasMoreMessages, messages.length]);

  // Auto-scroll to bottom for new messages (but not when user is scrolled up)
  useEffect(() => {
    if (messages.length > lastMessageCount && !userHasScrolled && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
    setLastMessageCount(messages.length);
  }, [messages.length, lastMessageCount, userHasScrolled]);

  // Auto-scroll during streaming if user hasn't manually scrolled
  useEffect(() => {
    if (isStreaming && !userHasScrolled && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [isStreaming, userHasScrolled, streamingMessage]);

  const handleLoadMore = async () => {
    if (activeChatId && !isLoadingMore) {
      await loadMoreMessages(activeChatId);
    }
  };

  const scrollToBottom = () => {
    setUserHasScrolled(false);
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTo({
          top: scrollArea.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

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
                  {isLoadingMore ? (
                    <>
                      <LoadingAnimation message="" />
                      <span className="ml-2">Loading...</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp size={14} className="mr-1" />
                      Load earlier messages
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Messages */}
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3"
                  role="article"
                  aria-label={`${message.role === 'user' ? 'You' : 'Assistant'} message`}
                >
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <User size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                        <Bot size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      {message.role === 'assistant' && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Assistant
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {message.content}
                    </div>
                    {message.role === 'assistant' && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          {(message.tokensIn || message.tokensOut) && (
                            <>
                              <MessageCostDisplay 
                                modelId={'unknown'} 
                                tokensIn={message.tokensIn} 
                                tokensOut={message.tokensOut}
                                className="text-xs"
                              />
                            </>
                          )}
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
                    <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <Bot size={16} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">Assistant</span>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      <StreamingText text={streamingMessage} isStreaming={isStreaming} />
                    </div>
                    
                    {/* Stop streaming button */}
                    {chatStreaming && (
                      <div className="mt-2">
                        <Button
                          onClick={stopStream}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                        >
                          Stop Generation
                        </Button>
                      </div>
                    )}
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
              className="shadow-lg hover:shadow-xl transition-shadow focus:ring-2 focus:ring-accent focus:ring-offset-2"
              aria-label="Jump to newest message in conversation"
            >
              <ChevronDown size={14} className="mr-1" />
              Jump to newest
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Transcript;