import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import { useConversationsStore } from "@/store/conversations";
import { useAuthStore } from "@/store/auth";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Plus, Wallet, RefreshCw, LogOut, User, MessageSquare, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const LeftMenu = () => {
  const { wallet, isLoadingWallet, reset, loadWallet } = useChatStore();
  const { 
    chatList, 
    activeChatId, 
    isLoadingChats, 
    loadChatList, 
    openChat, 
    archiveChat,
    createNewChat 
  } = useConversationsStore();
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [archivingChats, setArchivingChats] = useState<Set<string>>(new Set());

  // Load wallet data and chat list on component mount
  useEffect(() => {
    loadWallet();
    loadChatList();
  }, [loadWallet, loadChatList]);

  const handleNewChat = async () => {
    reset();
    await createNewChat();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const handleChatClick = (chatId: string) => {
    openChat(chatId);
  };

  const handleArchiveChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchivingChats(prev => new Set([...prev, chatId]));
    try {
      await archiveChat(chatId);
    } catch (error) {
      console.error('Failed to archive chat:', error);
    } finally {
      setArchivingChats(prev => {
        const next = new Set([...prev]);
        next.delete(chatId);
        return next;
      });
    }
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

      {/* Chat History */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground mb-2">Recent Chats</h3>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingChats ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted/70 rounded w-2/3" />
                </div>
              ))
            ) : chatList.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No chats yet. Start a new conversation!
              </div>
            ) : (
              chatList.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  className={`
                    group p-3 rounded-lg cursor-pointer transition-colors duration-200 relative
                    ${activeChatId === chat.id 
                      ? 'bg-accent/20 border border-accent/30' 
                      : 'hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {chat.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => handleArchiveChat(chat.id, e)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={archivingChats.has(chat.id)}
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
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