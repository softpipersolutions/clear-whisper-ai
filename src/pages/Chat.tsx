import { useState, useRef, useEffect } from "react";
import LeftMenu from "@/components/shell/LeftMenu";
import CenterChat from "@/components/chat/CenterChat";
import RightModels from "@/components/models/RightModels";
import Drawer from "@/components/common/Drawer";
import SkipToContent from "@/components/common/SkipToContent";
import { TopBar } from "@/components/mobile/TopBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useChatStore } from "@/store/chat";
import { motion } from "framer-motion";

const Chat = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModelsOpen, setIsModelsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const modelsButtonRef = useRef<HTMLButtonElement>(null);
  
  const { phase } = useChatStore();

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-open models drawer after submit on mobile
  useEffect(() => {
    if (isMobile && phase === 'ready') {
      setIsModelsOpen(true);
    }
  }, [isMobile, phase]);

  // Close one drawer when opening another
  const handleMenuOpen = () => {
    setIsModelsOpen(false);
    setIsMenuOpen(true);
  };

  const handleModelsOpen = () => {
    setIsMenuOpen(false);
    setIsModelsOpen(true);
  };

  const handleFocusComposer = () => {
    composerRef.current?.focus();
  };

  const handleEscape = () => {
    if (isMenuOpen) setIsMenuOpen(false);
    if (isModelsOpen) setIsModelsOpen(false);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onFocusComposer: handleFocusComposer,
    onToggleModels: isMobile ? () => setIsModelsOpen(!isModelsOpen) : undefined,
    onEscape: handleEscape,
  });

  // Check for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="h-screen bg-background transition-colors duration-200">
      <SkipToContent />
      
      {/* Mobile Layout */}
      {isMobile ? (
        <div className="h-full flex flex-col">
          <TopBar
            onMenuClick={handleMenuOpen}
            onModelsClick={handleModelsOpen}
            isMenuOpen={isMenuOpen}
            isModelsOpen={isModelsOpen}
          />
          
          <main className="flex-1 overflow-hidden" id="main-content">
            <CenterChat />
          </main>

          {/* Mobile Drawers */}
          <Drawer
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            title="Navigation"
            side="left"
            triggerRef={menuButtonRef}
          >
            <LeftMenu />
          </Drawer>

          <Drawer
            isOpen={isModelsOpen}
            onClose={() => setIsModelsOpen(false)}
            title="Model Suggestions"
            side="right"
            triggerRef={modelsButtonRef}
          >
            <RightModels />
          </Drawer>
        </div>
      ) : (
        /* Desktop Layout */
        <div className="h-full grid grid-cols-[280px_1fr_360px] gap-4 p-4">
          {/* Left Menu */}
          <motion.div 
            initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
            className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand"
          >
            <LeftMenu />
          </motion.div>
          
          {/* Center Chat */}
          <motion.main 
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.1 }}
            className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand flex flex-col"
            id="main-content"
          >
            <CenterChat />
          </motion.main>
          
          {/* Right Models */}
          <motion.div 
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.2 }}
            className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand"
          >
            <RightModels />
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Chat;