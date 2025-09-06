import { motion } from "framer-motion";

interface LoadingAnimationProps {
  message?: string;
}

export function LoadingAnimation({ message = "AI is thinking..." }: LoadingAnimationProps) {
  return (
    <motion.div 
      className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-1">
        <motion.div
          className="w-2 h-2 bg-neon-orange rounded-full"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0
          }}
        />
        <motion.div
          className="w-2 h-2 bg-neon-orange/70 rounded-full"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut", 
            delay: 0.2
          }}
        />
        <motion.div
          className="w-2 h-2 bg-neon-orange/50 rounded-full"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.4
          }}
        />
      </div>
      <motion.span 
        className="text-sm text-muted-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {message}
      </motion.span>
    </motion.div>
  );
}