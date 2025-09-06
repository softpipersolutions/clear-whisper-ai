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
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant={getPhaseColor()}>
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
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    </div>
  );
};

export default ChatHeader;