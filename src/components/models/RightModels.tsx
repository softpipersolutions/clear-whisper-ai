import { useChatStore } from "@/store/chat";
import { filterByTags } from "@/services/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Clock, FileText } from "lucide-react";

const RightModels = () => {
  const { phase, cost, tags, selectedModel, selectModel } = useChatStore();

  const models = filterByTags(tags);

  if (phase === 'estimating') {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-full mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Estimating...</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Type a message to see cost estimates and model recommendations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Cost Preview */}
      {cost && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <IndianRupee size={16} />
              Estimated Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">₹{cost.inr.toFixed(3)}</div>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Detected Tags</h3>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Models */}
      <div>
        <h3 className="text-sm font-medium mb-3">Available Models</h3>
        <div className="space-y-2">
          {models.map((model) => (
            <Card 
              key={model.id} 
              className={`cursor-pointer transition-colors ${
                selectedModel === model.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => selectModel(model.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{model.name}</h4>
                  {selectedModel === model.id && (
                    <Badge variant="default" className="text-xs">Selected</Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {model.badges.map((badge) => (
                    <Badge key={badge} variant="outline" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    {model.latencyMs}ms
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText size={10} />
                    {(model.context / 1000).toFixed(0)}k
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {selectedModel && phase === 'ready' && (
        <Button className="w-full" disabled>
          Type message to start
        </Button>
      )}
    </div>
  );
};

export default RightModels;