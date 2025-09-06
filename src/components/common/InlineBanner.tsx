import { Button } from "@/components/ui/button";
import { AlertTriangle, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InlineBannerProps {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const InlineBanner = ({ 
  type, 
  title, 
  message, 
  onRetry, 
  onDismiss, 
  className = "" 
}: InlineBannerProps) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-destructive/10',
          border: 'border-destructive/20',
          text: 'text-destructive',
          icon: 'text-destructive'
        };
      case 'warning':
        return {
          bg: 'bg-accent/10',
          border: 'border-accent/20',
          text: 'text-accent-foreground',
          icon: 'text-accent'
        };
      case 'info':
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-foreground',
          icon: 'text-muted-foreground'
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-foreground',
          icon: 'text-muted-foreground'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`
          ${styles.bg} ${styles.border} ${styles.text}
          border rounded-xl p-4 ${className}
        `}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className={`${styles.icon} mt-0.5 flex-shrink-0`} />
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-1">{title}</h4>
            <p className="text-sm opacity-90">{message}</p>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-8 px-2 hover:bg-background/50"
              >
                <RotateCcw size={14} className="mr-1" />
                Retry
              </Button>
            )}
            
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0 hover:bg-background/50"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InlineBanner;