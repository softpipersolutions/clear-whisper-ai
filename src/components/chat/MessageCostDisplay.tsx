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
    
    let totalCost = inputCost + outputCost;
    
    // Convert to user's preferred currency if needed
    if (currency !== 'USD' && rates[currency]) {
      totalCost = totalCost * rates[currency].rate;
    }
    
    const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
    
    return {
      cost: totalCost,
      formatted: `${currencySymbol}${totalCost.toFixed(totalCost < 0.01 ? 4 : 2)}`
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