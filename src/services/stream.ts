export async function startStream(
  text: string,
  onDelta: (delta: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  // Mock response text
  const responses = [
    "I understand you'd like help with that. Let me provide you with a comprehensive response.",
    "Based on your question, here are some key points to consider:",
    "Thank you for your question. Here's what I can tell you about this topic:",
    "That's an interesting question. Let me break this down for you:",
    "I'd be happy to help with that. Here's my analysis:"
  ];
  
  const response = responses[Math.floor(Math.random() * responses.length)];
  const words = response.split(' ');
  
  try {
    for (let i = 0; i < words.length; i++) {
      // Check if stream was cancelled
      if (signal?.aborted) {
        throw new Error('Stream aborted');
      }
      
      const word = i === 0 ? words[i] : ' ' + words[i];
      onDelta(word);
      
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
    }
    
    // Add a final period if not already there
    if (!response.endsWith('.') && !response.endsWith('!') && !response.endsWith('?')) {
      onDelta('.');
    }
    
    onDone();
  } catch (error) {
    if (signal?.aborted) {
      // Stream was cancelled - this is expected
      return;
    }
    throw error;
  }
}