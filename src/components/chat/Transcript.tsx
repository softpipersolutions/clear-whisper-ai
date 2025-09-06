import { useChatStore } from "@/store/chat";
import { User, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

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
  const { messages, phase } = useChatStore();

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
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div 
            key={index}
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
                {message.role === 'assistant' && index === messages.length - 1 && phase === 'executing' ? (
                  <TypewriterText text={message.text} isComplete={false} />
                ) : (
                  message.text
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Transcript;