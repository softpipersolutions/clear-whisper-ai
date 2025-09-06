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

  // Calculate exact cost for current query
  const calculateCost = () => {
    if (!cost || !user?.user_metadata?.preferred_currency) {
      return null;
    }

    const currency = user.user_metadata.preferred_currency;
    let totalCost = cost.inr;
    
    // Convert from INR to user's preferred currency if needed
    if (currency !== 'INR' && rates[currency]) {
      totalCost = totalCost / rates[currency].rate;
    }
    
    const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
    
    return {
      cost: totalCost,
      currency: currencySymbol,
      formatted: `${currencySymbol}${totalCost.toFixed(totalCost < 0.01 ? 4 : 2)}`
    };
  };

  const costInfo = calculateCost();

  if (!costInfo) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        Calculating cost...
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