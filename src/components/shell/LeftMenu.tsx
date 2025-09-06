import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Plus, Wallet, RefreshCw, LogOut, User } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LeftMenu = () => {
  const { wallet, isLoadingWallet, reset, loadWallet } = useChatStore();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  // Load wallet data on component mount
  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleNewChat = () => {
    reset();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
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

      {/* User Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 bg-secondary rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.email || 'User'}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
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
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-brown" />
            <span className="text-muted-foreground">Wallet:</span>
            {isLoadingWallet ? (
              <div className="w-12 h-4 bg-muted animate-pulse rounded" />
            ) : (
              <span className="font-medium text-foreground">₹{wallet.inr.toFixed(2)}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWallet}
            disabled={isLoadingWallet}
            className="h-6 w-6 p-0"
          >
            <RefreshCw size={12} className={isLoadingWallet ? "animate-spin" : ""} />
          </Button>
        </div>
        
        <Button
          onClick={() => navigate('/recharge')}
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
        >
          <Plus size={12} className="mr-1" />
          Add Money
        </Button>
      </div>
    </div>
  );
};

export default LeftMenu;