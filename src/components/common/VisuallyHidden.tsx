import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VisuallyHiddenProps {
  children: ReactNode;
  className?: string;
}

const VisuallyHidden = ({ children, className }: VisuallyHiddenProps) => {
  return (
    <span 
      className={cn(
        "absolute -inset-px p-0 border-0 h-px w-px overflow-hidden whitespace-nowrap",
        "clip-path-[inset(50%)]",
        className
      )}
      style={{ clipPath: 'inset(50%)' }}
    >
      {children}
    </span>
  );
};

export default VisuallyHidden;