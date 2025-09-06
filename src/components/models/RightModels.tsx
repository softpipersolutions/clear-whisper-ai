import { useChatStore } from "@/store/chat";
import { filterByTags } from "@/services/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/common/Skeleton";
import InlineBanner from "@/components/common/InlineBanner";
import { IndianRupee, Clock, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RightModels = () => {
  const { phase, cost, tags, selectedModel, selectModel, error, retryLastOperation } = useChatStore();

  const models = filterByTags(tags);

  if (phase === 'estimating') {
    return (
      <div className="p-4 space-y-4">
        {/* Cost skeleton */}
        <Card className="rounded-2xl shadow-brand">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <IndianRupee size={16} className="text-muted-foreground" />
              <SkeletonText className="w-24 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-16" />
          </CardContent>
        </Card>

        {/* Tags skeleton */}
        <div>
          <SkeletonText className="w-20 h-4 mb-2" />
          <div className="flex gap-1">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        {/* Models skeleton */}
        <div>
          <SkeletonText className="w-28 h-4 mb-3" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} className="h-20" />
            ))}
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
      {/* Error Banner */}
      {error && error !== 'INSUFFICIENT_FUNDS' && (
        <InlineBanner
          type="error"
          title="Connection Error"
          message="Failed to load data from server. Using cached information."
          onRetry={retryLastOperation}
          onDismiss={() => {/* Could add dismiss functionality */}}
        />
      )}
      
      {error === 'INSUFFICIENT_FUNDS' && (
        <InlineBanner
          type="error"
          title="Insufficient Funds"
          message="Please add credits to your wallet to continue."
          onRetry={() => {
            // Navigate to recharge page
            window.location.href = '/recharge';
          }}
        />
      )}

      {/* Cost Preview */}
      <AnimatePresence>
        {cost && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="rounded-2xl shadow-brand hover:shadow-brand-hover transition-shadow duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IndianRupee size={16} className="text-accent" />
                  Estimated Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-foreground">₹{cost.inr.toFixed(3)}</div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags */}
      <AnimatePresence>
        {tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-sm font-medium mb-2 text-foreground">Detected Tags</h3>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Badge variant="secondary" className="text-xs shadow-sm">
                    {tag}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Models */}
      <div>
        <h3 className="text-sm font-medium mb-3 text-foreground">Available Models</h3>
        <div className="space-y-2">
          <AnimatePresence>
            {models.map((model, index) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ 
                  duration: 0.25,
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 220,
                  damping: 28
                }}
                whileHover={{ 
                  y: -2,
                  transition: { duration: 0.15 }
                }}
              >
                <Card 
                  className={`cursor-pointer transition-all duration-200 rounded-2xl ${
                    selectedModel === model.id 
                      ? 'ring-2 ring-accent bg-accent/5 shadow-brand-hover' 
                      : 'hover:bg-muted/30 shadow-brand hover:shadow-brand-hover'
                  }`}
                  onClick={() => selectModel(model.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">{model.name}</h4>
                      {selectedModel === model.id && (
                        <Badge className="text-xs bg-accent text-accent-foreground shadow-sm">Selected</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-2">
                      {model.badges.map((badge) => (
                        <Badge key={badge} variant="outline" className="text-xs border-border">
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Button */}
      <AnimatePresence>
        {selectedModel && phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Button 
              className="w-full bg-muted text-muted-foreground cursor-not-allowed rounded-xl shadow-brand" 
              disabled
            >
              Type message to start
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RightModels;