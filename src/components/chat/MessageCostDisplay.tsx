import { useAuthStore } from "@/store/auth";
import { useFxStore } from "@/store/fx";
import { useModelsStore } from "@/store/models";

interface MessageCostDisplayProps {
  tokensIn: number;
  tokensOut: number;
  modelId: string;
  className?: string;
}

export function MessageCostDisplay({ 
  tokensIn, 
  tokensOut, 
  modelId, 
  className = "" 
}: MessageCostDisplayProps) {
  const { user } = useAuthStore();
  const { rates } = useFxStore();
  const { getModelById, pricing: modelPricing } = useModelsStore();

  const calculateMessageCost = () => {
    const model = getModelById(modelId);
    if (!model || !user?.user_metadata?.preferred_currency) {
      return null;
    }

    const currency = user.user_metadata.preferred_currency;
    
    // Get pricing - prefer from pricing store, fallback to model's USD pricing
    const modelPricingData = modelPricing?.rates?.[modelId];
    const inputCostPer1M = modelPricingData?.inputPer1M || model.pricingUSD.inputPer1M;
    const outputCostPer1M = modelPricingData?.outputPer1M || model.pricingUSD.outputPer1M;
    
    const inputCost = (tokensIn / 1000000) * inputCostPer1M;
    const outputCost = (tokensOut / 1000000) * outputCostPer1M;
    
    let totalCostUSD = inputCost + outputCost;
    
    // Convert USD to INR first (our base currency)
    let totalCostINR = totalCostUSD;
    if (rates.USD && typeof rates.USD.rate === 'number') {
      totalCostINR = totalCostUSD / rates.USD.rate; // Convert USD to INR
    }
    
    // Then convert to user's preferred currency
    if (currency === 'INR') {
      return {
        cost: totalCostINR,
        formatted: `₹${totalCostINR.toFixed(totalCostINR < 0.01 ? 4 : 2)}`
      };
    } else if (currency !== 'INR' && rates[currency]) {
      const finalCost = totalCostINR * rates[currency].rate;
      const currencySymbol = currency === 'USD' ? '$' : currency;
      return {
        cost: finalCost,
        formatted: `${currencySymbol}${finalCost.toFixed(finalCost < 0.01 ? 4 : 2)}`
      };
    }
    
    // Fallback to INR
    return {
      cost: totalCostINR,
      formatted: `₹${totalCostINR.toFixed(totalCostINR < 0.01 ? 4 : 2)}`
    };
  };

  const costInfo = calculateMessageCost();

  if (!costInfo) {
    return null;
  }

  return (
    <span className={`text-neon-orange font-medium ${className}`}>
      • {costInfo.formatted} cost
    </span>
  );
}