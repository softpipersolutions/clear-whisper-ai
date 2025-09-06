import { useChatStore } from "@/store/chat";
import { getModelById } from "@/services/models";
import { Badge } from "@/components/ui/badge";

const ChatHeader = () => {
  const { phase, selectedModel } = useChatStore();
  
  const model = selectedModel ? getModelById(selectedModel) : null;

  const getPhaseDisplay = () => {
    switch (phase) {
      case 'idle':
        return 'Ready';
      case 'estimating':
        return 'Estimating...';
      case 'ready':
        return 'Ready to chat';
      case 'executing':
        return 'Generating...';
      default:
        return 'Ready';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'estimating':
      case 'executing':
        return 'secondary';
      case 'ready':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <div className="sticky top-0 p-4 flex items-center justify-between bg-panel/80 backdrop-blur-brand border-b border-border">
      <div className="flex items-center gap-2">
        <Badge variant={getPhaseColor()} className="shadow-sm">
          {getPhaseDisplay()}
        </Badge>
        {model && (
          <span className="text-sm text-muted-foreground">
            using {model.name}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {phase === 'executing' && (
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-sm" />
        )}
      </div>
    </div>
  );
};

export default ChatHeader;