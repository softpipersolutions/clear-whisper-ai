import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useFxStore } from "@/store/fx";
import { useModelsStore } from "@/store/models";
import { filterByTags } from "@/adapters/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/common/Skeleton";
import InlineBanner from "@/components/common/InlineBanner";
import { IndianRupee, Clock, FileText, AlertCircle, Lock, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const RightModels = () => {
  const { phase, cost, tags, selectedModel, selectModel, error, retryLastOperation, query, startStream } = useChatStore();
  const [isStartingChat, setIsStartingChat] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { convertFromINR, fetchFxRate, isStale, rates, error: fxError } = useFxStore();
  const { models: allModels, pricing, fx, loading: modelsLoading, fetchModels, forceRefresh } = useModelsStore();
  
  // Get user's preferred currency
  const userCurrency = user?.user_metadata?.preferred_currency || 'INR';
  
  // Fetch models and FX rate when component mounts
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);
  
  // Listen for NO_API_KEY errors to refresh models
  useEffect(() => {
    if (error === 'Provider key not configured') {
      // Force refresh models to update locked states
      forceRefresh();
    }
  }, [error, forceRefresh]);
  
  // Fetch FX rate when component mounts or currency changes
  useEffect(() => {
    if (userCurrency !== 'INR' && cost) {
      fetchFxRate(userCurrency);
    }
  }, [userCurrency, cost, fetchFxRate]);

  const models = filterByTags(allModels, tags);

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

  // Check if FX rates are stale
  const isRateStale = userCurrency !== 'INR' && isStale(userCurrency);
  
  return (
    <div className="p-4 space-y-4">
      {/* FX Stale Banner */}
      {isRateStale && (
        <InlineBanner
          type="warning"
          title="Exchange Rates Outdated"
          message="Exchange rates may be outdated. Displayed amounts are approximate."
        />
      )}
      
      {/* FX Error Banner */}
      {fxError === 'FX_UNAVAILABLE' && userCurrency !== 'INR' && (
        <InlineBanner
          type="error"
          title="Exchange Rates Unavailable"
          message="Unable to load exchange rates. Showing amounts in INR only."
        />
      )}
      
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
                {userCurrency === 'INR' || fxError === 'FX_UNAVAILABLE' ? (
                  <div className="text-lg font-semibold text-foreground">₹{cost.inr.toFixed(3)}</div>
                ) : (
                  <div className="flex flex-col">
                    <div className="text-lg font-semibold text-foreground">
                      {userCurrency === 'USD' ? '$' : userCurrency === 'EUR' ? '€' : userCurrency + ' '}
                      {convertFromINR(cost.inr, userCurrency).toFixed(3)}
                    </div>
                    <div className="text-xs text-muted-foreground">≈ ₹{cost.inr.toFixed(3)}</div>
                  </div>
                )}
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
                      : model.locked
                      ? 'opacity-60 cursor-not-allowed shadow-brand'
                      : 'hover:bg-muted/30 shadow-brand hover:shadow-brand-hover'
                  }`}
                  onClick={async () => {
                    if (model.locked || isStartingChat) return;
                    
                    try {
                      // First select the model
                      selectModel(model.id);
                      
                      // Auto-start chat if user has typed a query and we're ready
                      if (query.trim() && phase === 'ready') {
                        setIsStartingChat(model.id);
                        await startStream(query, model.id);
                      }
                    } catch (error) {
                      console.error('Error starting instant chat:', error);
                    } finally {
                      setIsStartingChat(null);
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">{model.label}</h4>
                      <div className="flex items-center gap-1">
                        {isStartingChat === model.id && (
                          <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
                        )}
                        {model.locked && (
                          <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950">
                            <Lock size={8} className="mr-1" />
                            Locked
                          </Badge>
                        )}
                        {model.pricingUSD.unit === 'audioTokens' && (
                          <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950">
                            <Volume2 size={8} className="mr-1" />
                            Audio
                          </Badge>
                        )}
                        {selectedModel === model.id && (
                          <Badge className="text-xs bg-accent text-accent-foreground shadow-sm">Selected</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-2">
                      {model.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs border-border">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{model.family}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="capitalize">{model.provider}</span>
                      </div>
                      {pricing.rates[model.id] && (
                        <div className="flex items-center gap-1">
                          <IndianRupee size={8} />
                          {pricing.currency === 'INR' ? '₹' : '$'}
                          {pricing.rates[model.id].inputPer1M.toFixed(2)}/1M
                        </div>
                      )}
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