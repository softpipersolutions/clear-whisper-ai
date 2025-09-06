import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chat";
import { Send, Square } from "lucide-react";

const ChatComposer = () => {
  const { 
    query, 
    phase, 
    selectedModel, 
    setQuery, 
    submitQuery, 
    startStream, 
    stopStream,
    error 
  } = useChatStore();

  const [localQuery, setLocalQuery] = useState(query);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!localQuery.trim()) return;
    
    setQuery(localQuery);
    
    // If we have a selected model and are ready, start streaming
    if (phase === 'ready' && selectedModel) {
      startStream(localQuery, selectedModel);
      setLocalQuery('');
    } else {
      // Otherwise, just estimate
      submitQuery();
    }
  };

  const handleStop = () => {
    stopStream();
  };

  const isExecuting = phase === 'executing';
  const canSubmit = localQuery.trim() && !isExecuting;
  const canStop = isExecuting;

  return (
    <div className="p-4">
      {error && (
        <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      
      <div className="flex gap-2">
        <Textarea
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="min-h-[60px] resize-none"
          disabled={isExecuting}
        />
        
        <div className="flex flex-col gap-2">
          {canStop ? (
            <Button
              onClick={handleStop}
              variant="destructive"
              size="icon"
              className="h-[60px] w-12 shadow-brand hover:shadow-brand-hover transition-all duration-200"
            >
              <Square size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="icon"
              className="h-[60px] w-12 bg-accent hover:bg-accent/90 text-accent-foreground shadow-brand hover:shadow-brand-hover transition-all duration-200"
            >
              <Send size={16} />
            </Button>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        {phase === 'idle' && "Enter to estimate • Shift+Enter for new line"}
        {phase === 'estimating' && "Estimating cost and generating tags..."}
        {phase === 'ready' && "Select a model to start chatting"}
        {phase === 'executing' && "Generating response..."}
      </div>
    </div>
  );
};

export default ChatComposer;
