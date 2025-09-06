export interface TokenEstimate {
  input: number;
  output: number;
}

export function estimateTokens(message: string): TokenEstimate {
  // Simple token estimation: ~4 characters per token
  const inputTokens = Math.ceil(message.length / 4);
  const outputTokens = Math.ceil(inputTokens * 1.5); // Assume response is 1.5x input
  
  return {
    input: inputTokens,
    output: outputTokens
  };
}

export function estimateCostINR(tokens: TokenEstimate): number {
  // Mock pricing: ₹0.001 per input token, ₹0.002 per output token
  const inputCost = tokens.input * 0.001;
  const outputCost = tokens.output * 0.002;
  
  return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimals
}

export function inferTags(message: string): string[] {
  const text = message.toLowerCase();
  const tags: string[] = [];
  
  // Simple keyword-based tag inference
  if (text.includes('code') || text.includes('programming') || text.includes('function')) {
    tags.push('coding');
  }
  if (text.includes('write') || text.includes('essay') || text.includes('article')) {
    tags.push('writing');
  }
  if (text.includes('analyze') || text.includes('data') || text.includes('research')) {
    tags.push('analysis');
  }
  if (text.includes('creative') || text.includes('story') || text.includes('poem')) {
    tags.push('creative');
  }
  if (text.includes('help') || text.includes('how') || text.includes('what') || text.includes('explain')) {
    tags.push('helpful');
  }
  
  // Default tag if no specific category found
  if (tags.length === 0) {
    tags.push('general');
  }
  
  return tags;
}