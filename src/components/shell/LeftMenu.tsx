import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import { Plus, Wallet } from "lucide-react";

const LeftMenu = () => {
  const { wallet, reset } = useChatStore();

  const handleNewChat = () => {
    reset();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CC</span>
          </div>
          <span className="font-semibold">ClearChat</span>
        </div>
        
        <Button 
          onClick={handleNewChat}
          variant="outline" 
          className="w-full justify-start gap-2"
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
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm">
          <Wallet size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">Wallet:</span>
          <span className="font-medium">₹{wallet.inr.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default LeftMenu;