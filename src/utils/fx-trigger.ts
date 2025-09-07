import { callFunction } from "@/adapters/backend";

export async function triggerFxUpdate(): Promise<boolean> {
  try {
    console.log('Triggering FX rates update...');
    
    const response = await callFunction<{
      success: boolean;
      message: string;
      data?: any;
    }>('fx-trigger');
    
    console.log('FX trigger response:', response);
    return response.success;
  } catch (error) {
    console.error('Failed to trigger FX update:', error);
    return false;
  }
}