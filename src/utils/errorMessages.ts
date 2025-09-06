// Error code mapping for friendly user messages
export function mapErrorCodeToMessage(errorCode: string, retryAfter?: number): string {
  switch (errorCode) {
    case 'RATE_LIMITED':
      return `You're doing that too quickly. Try again${retryAfter ? ` in ${retryAfter}s` : ' in a moment'}.`;
    case 'FX_UNAVAILABLE':
      return 'FX service is temporarily unavailable; showing INR only.';
    case 'SERVICE_UNAVAILABLE':
      return 'AI service is busy. Please try again shortly.';
    case 'INSUFFICIENT_FUNDS':
      return 'Top up your wallet to continue.';
    case 'NO_API_KEY':
      return 'Provider key not configured. Model is temporarily locked.';
    case 'UNAUTHORIZED':
      return 'Authentication failed. Please sign in again.';
    case 'BAD_INPUT':
      return 'Invalid request. Please check your input and try again.';
    case 'NETWORK':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function shouldShowRetryButton(errorCode: string): boolean {
  return !['INSUFFICIENT_FUNDS', 'NO_API_KEY', 'UNAUTHORIZED'].includes(errorCode);
}

export function getRetryAction(errorCode: string): string {
  switch (errorCode) {
    case 'INSUFFICIENT_FUNDS':
      return 'Recharge';
    case 'RATE_LIMITED':
      return 'Retry';
    case 'SERVICE_UNAVAILABLE':
    case 'NETWORK':
      return 'Try Again';
    default:
      return 'Retry';
  }
}