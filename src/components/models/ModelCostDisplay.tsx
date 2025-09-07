import { motion } from "framer-motion";
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
  message?: string;
  tags?: string[];
  className?: string;
}

export function ModelCostDisplay({ model, message, tags, className = "" }: ModelCostDisplayProps) {
  const { user } = useAuthStore();
  const { rates, convertFromINR } = useFxStore();
  const { pricing: modelPricing } = useModelsStore();

  // Calculate cost directly from model pricing with dynamic token estimation
  const calculateCost = () => {
    // Default to INR if no preferred currency is set
    const currency = user?.user_metadata?.preferred_currency || 'INR';
    
    // Estimate input tokens based on string length
    const estimatedTokensIn = message ? Math.ceil(message.length / 4) + 30 : 2000;
    // +30 for system / overhead tokens

    // Choose output multiplier based on tags
    let multiplier = 1.3; // default
    if (tags?.includes("quick")) multiplier = 0.8;
    if (tags?.includes("code")) multiplier = 1.2;
    if (tags?.includes("reasoning")) multiplier = 1.5;

    // Estimate output tokens
    const estimatedTokensOut = message ? Math.ceil(estimatedTokensIn * multiplier) : 2000;
    
    // Get pricing - prefer from pricing store, fallback to model's USD pricing
    const modelPricingData = modelPricing?.rates?.[model.id];
    const inputCostPer1M = modelPricingData?.inputPer1M || model.pricingUSD.inputPer1M;
    const outputCostPer1M = modelPricingData?.outputPer1M || model.pricingUSD.outputPer1M;
    
    const inputCostUSD = (estimatedTokensIn / 1000000) * inputCostPer1M;
    const outputCostUSD = (estimatedTokensOut / 1000000) * outputCostPer1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    
    // Convert USD to INR first (our base currency)
    let totalCostINR = totalCostUSD * 84; // Fallback rate if FX unavailable
    if (rates.USD && typeof rates.USD.rate === 'number') {
      totalCostINR = totalCostUSD * rates.USD.rate; // Convert USD to INR using proper rate
    }
    
    // For INR, use cost directly
    if (currency === 'INR') {
      return {
        cost: totalCostINR,
        currency: '₹',
        formatted: `₹${totalCostINR.toFixed(totalCostINR < 0.01 ? 4 : 2)}`
      };
    }
    
    // For other currencies, try to convert or fallback to INR
    if (rates[currency]) {
      const convertedCost = convertFromINR(totalCostINR, currency);
      const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
      
      return {
        cost: convertedCost,
        currency: currencySymbol,
        formatted: `${currencySymbol}${convertedCost.toFixed(convertedCost < 0.01 ? 4 : 2)}`
      };
    }
    
    // Fallback to INR if conversion not available
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