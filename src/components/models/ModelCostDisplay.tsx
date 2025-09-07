import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { useFxStore } from "@/store/fx";
import { useModelsStore } from "@/store/models";
import { useChatStore } from "@/store/chat";

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
  const { user } = useAuthStore();
  const { rates, convertFromINR } = useFxStore();
  const { pricing: modelPricing } = useModelsStore();
  const { costEstimateData } = useChatStore();

  // Calculate cost using actual query estimation or fallback to default estimation
  const calculateCost = () => {
    const currency = user?.user_metadata?.preferred_currency || 'INR';
    
    // Try to use actual cost estimate data for this model if available
    if (costEstimateData?.costs) {
      const modelCost = costEstimateData.costs.find((cost: any) => cost.modelId === model.id);
      if (modelCost) {
        // Use actual estimated cost for this query
        const costINR = modelCost.costINR;
        
        if (currency === 'INR') {
          return {
            cost: costINR,
            currency: '₹',
            formatted: `₹${costINR.toFixed(costINR < 0.01 ? 4 : 2)}`
          };
        }
        
        // Convert to other currencies if available
        if (rates[currency]) {
          const convertedCost = convertFromINR(costINR, currency);
          const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
          return {
            cost: convertedCost,
            currency: currencySymbol,
            formatted: `${currencySymbol}${convertedCost.toFixed(convertedCost < 0.01 ? 4 : 2)}`
          };
        }
        
        return {
          cost: costINR,
          currency: '₹',
          formatted: `₹${costINR.toFixed(costINR < 0.01 ? 4 : 2)}`
        };
      }
    }
    
    // Fallback to estimated cost calculation (2000 in, 2000 out tokens)
    const estimatedTokensIn = 2000;
    const estimatedTokensOut = 2000;
    
    const modelPricingData = modelPricing?.rates?.[model.id];
    const inputCostPer1M = modelPricingData?.inputPer1M || model.pricingUSD.inputPer1M;
    const outputCostPer1M = modelPricingData?.outputPer1M || model.pricingUSD.outputPer1M;
    
    const inputCostUSD = (estimatedTokensIn / 1000000) * inputCostPer1M;
    const outputCostUSD = (estimatedTokensOut / 1000000) * outputCostPer1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    
    let totalCostINR = totalCostUSD * 84; // Fallback rate
    if (rates.USD && typeof rates.USD.rate === 'number') {
      totalCostINR = totalCostUSD * rates.USD.rate;
    }
    
    if (currency === 'INR') {
      return {
        cost: totalCostINR,
        currency: '₹',
        formatted: `₹${totalCostINR.toFixed(totalCostINR < 0.01 ? 4 : 2)} (est)`
      };
    }
    
    if (rates[currency]) {
      const convertedCost = convertFromINR(totalCostINR, currency);
      const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
      return {
        cost: convertedCost,
        currency: currencySymbol,
        formatted: `${currencySymbol}${convertedCost.toFixed(convertedCost < 0.01 ? 4 : 2)} (est)`
      };
    }
    
    return {
      cost: totalCostINR,
      currency: '₹',
      formatted: `₹${totalCostINR.toFixed(totalCostINR < 0.01 ? 4 : 2)} (est)`
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