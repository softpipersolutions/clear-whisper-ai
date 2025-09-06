import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Brain } from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { useAuthStore } from "@/store/auth";

interface TopBarProps {
  onMenuClick: () => void;
  onModelsClick: () => void;
  isMenuOpen: boolean;
  isModelsOpen: boolean;
}

const TopBar = ({ onMenuClick, onModelsClick, isMenuOpen, isModelsOpen }: TopBarProps) => {
  const { user } = useAuthStore();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const modelsButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-brand border-b border-border">
      <div className="flex items-center justify-between p-4">
        {/* Left side - Menu button */}
        <Button
          ref={menuButtonRef}
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="h-10 w-10 p-0"
          aria-controls="navigation-drawer"
          aria-expanded={isMenuOpen}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </Button>

        {/* Center - App branding */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-brand">
            <span className="text-accent-foreground font-bold text-sm">CC</span>
          </div>
          <span className="font-semibold text-foreground">ClearChat</span>
        </div>

        {/* Right side - Models button and theme */}
        <div className="flex items-center gap-2">
          <Button
            ref={modelsButtonRef}
            variant="ghost"
            size="sm"
            onClick={onModelsClick}
            className="h-10 w-10 p-0"
            aria-controls="models-drawer"
            aria-expanded={isModelsOpen}
            aria-label="Open model suggestions"
          >
            <Brain size={18} />
          </Button>
          
          <ThemeToggle />
        </div>
      </div>
      
      {/* User indicator */}
      {user && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center">
              <span className="text-accent-foreground font-medium text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="truncate">{user.email}</span>
          </div>
        </div>
      )}
    </header>
  );
};

export { TopBar };