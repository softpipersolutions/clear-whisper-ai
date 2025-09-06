import { ReactNode, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
  side?: 'left' | 'right';
  className?: string;
  triggerRef?: React.RefObject<HTMLElement>;
}

const Drawer = ({ 
  isOpen, 
  onClose, 
  children, 
  title, 
  side = 'right', 
  className,
  triggerRef 
}: DrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Focus management
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (event.key === 'Escape') {
        onClose();
      }
      
      // Focus trap
      if (event.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Return focus to trigger when closing
  useEffect(() => {
    if (!isOpen && triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [isOpen, triggerRef]);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slideVariants = {
    hidden: {
      x: side === 'left' ? '-100%' : '100%',
      opacity: prefersReducedMotion ? 0 : 1
    },
    visible: {
      x: 0,
      opacity: 1
    },
    exit: {
      x: side === 'left' ? '-100%' : '100%',
      opacity: prefersReducedMotion ? 0 : 1
    }
  };

  const transitionConfig = prefersReducedMotion 
    ? { duration: 0.15 }
    : {
        type: "spring" as const,
        stiffness: 280,
        damping: 30,
        mass: 0.8
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          
          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitionConfig}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "fixed top-0 z-50 h-full bg-background border-l border-border shadow-2xl",
              "flex flex-col w-80 max-w-[90vw]",
              side === 'left' ? "left-0 border-l-0 border-r" : "right-0",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-brand">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-muted"
                aria-label="Close drawer"
              >
                <X size={16} />
              </Button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;