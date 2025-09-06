import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Plus, Wallet } from "lucide-react";

const LeftMenu = () => {
  const { wallet, reset } = useChatStore();

  const handleNewChat = () => {
    reset();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 p-4 border-b border-border bg-panel/80 backdrop-blur-brand">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-brand">
              <span className="text-accent-foreground font-bold text-sm">CC</span>
            </div>
            <span className="font-semibold text-foreground">ClearChat</span>
          </div>
          <ThemeToggle />
        </div>
        
        <Button 
          onClick={handleNewChat}
          className="w-full justify-start gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-brand hover:shadow-brand-hover transition-all duration-200"
        >
          <Plus size={16} />
          New Chat
        </Button>
      </div>

      {/* Main content area - placeholder for chat history */}
      <div className="flex-1 p-4">
        <div className="text-sm text-muted-foreground">
          Chat history will appear here
        </div>
      </div>

      {/* Wallet */}
      <div className="sticky bottom-0 p-4 border-t border-border bg-panel/80 backdrop-blur-brand">
        <div className="flex items-center gap-2 text-sm">
          <Wallet size={16} className="text-brown" />
          <span className="text-muted-foreground">Wallet:</span>
          <span className="font-medium text-foreground">₹{wallet.inr.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default LeftMenu;