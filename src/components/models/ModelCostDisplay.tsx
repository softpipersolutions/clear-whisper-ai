import { motion } from "framer-motion";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useFxStore } from "@/store/fx";
import { useModelsStore } from "@/store/models";

interface ModelCostDisplayProps {
  model: {
    id: string;
    pricingUSD: {
      inputPer1M: number;
      outputPer1M: number;
    };
  };
  className?: string;
}

export function ModelCostDisplay({ model, className = "" }: ModelCostDisplayProps) {
  const { cost } = useChatStore();
  const { user } = useAuthStore();
  const { rates } = useFxStore();
  const { pricing: modelPricing } = useModelsStore();

  // Calculate exact cost for current query with timeout fallback
  const calculateCost = () => {
    if (!cost || !user?.user_metadata?.preferred_currency) {
      return null;
    }

    const currency = user.user_metadata.preferred_currency;
    
    // For INR, use cost directly
    if (currency === 'INR') {
      return {
        cost: cost.inr,
        currency: '₹',
        formatted: `₹${cost.inr.toFixed(cost.inr < 0.01 ? 4 : 2)}`
      };
    }
    
    // For other currencies, try to convert or fallback to INR
    if (rates[currency]) {
      const convertedCost = cost.inr / rates[currency].rate;
      const currencySymbol = currency === 'USD' ? '$' : currency;
      
      return {
        cost: convertedCost,
        currency: currencySymbol,
        formatted: `${currencySymbol}${convertedCost.toFixed(convertedCost < 0.01 ? 4 : 2)}`
      };
    }
    
    // Fallback to INR if conversion not available
    return {
      cost: cost.inr,
      currency: '₹',
      formatted: `₹${cost.inr.toFixed(cost.inr < 0.01 ? 4 : 2)} (estimated)`
    };
  };

  const costInfo = calculateCost();

  if (!costInfo) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        <span className="inline-flex items-center gap-1">
          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
          Calculating cost...
        </span>
      </div>
    );
  }

  return (
    <motion.div 
      className={`text-xs font-medium ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <span className="text-neon-orange">
        {costInfo.formatted}
      </span>
      <span className="text-muted-foreground ml-1">
        for this query
      </span>
    </motion.div>
  );
}