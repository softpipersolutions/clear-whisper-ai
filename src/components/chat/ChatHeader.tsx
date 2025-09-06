import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversationsStore } from "@/store/conversations";
import { MoreHorizontal, Edit3, Archive, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ChatHeader = () => {
  const { 
    activeChatId, 
    chatList, 
    renameChat, 
    archiveChat 
  } = useConversationsStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const activeChat = chatList.find(chat => chat.id === activeChatId);

  if (!activeChat) {
    return (
      <div className="flex items-center justify-between p-4 border-b border-border bg-panel/80 backdrop-blur-brand">
        <h2 className="text-lg font-semibold text-foreground">
          Welcome to ClearChat
        </h2>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditTitle(activeChat.title);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editTitle.trim() && editTitle !== activeChat.title) {
      try {
        await renameChat(activeChatId!, editTitle.trim());
      } catch (error) {
        console.error('Failed to rename chat:', error);
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
  };

  const handleArchive = async () => {
    try {
      await archiveChat(activeChatId!);
    } catch (error) {
      console.error('Failed to archive chat:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-panel/80 backdrop-blur-brand">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              className="h-8 text-lg font-semibold"
              autoFocus
              maxLength={500}
            />
            <Button
              onClick={handleSaveEdit}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleCancelEdit}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <h2 
            className="text-lg font-semibold text-foreground truncate cursor-pointer hover:text-accent transition-colors"
            onClick={handleStartEdit}
            title="Click to edit title"
          >
            {activeChat.title}
          </h2>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleStartEdit}>
            <Edit3 className="h-4 w-4 mr-2" />
            Rename Chat
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive} className="text-destructive">
            <Archive className="h-4 w-4 mr-2" />
            Archive Chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ChatHeader;