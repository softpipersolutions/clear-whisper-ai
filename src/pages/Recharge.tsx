import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, RefreshCw } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { createOrder } from "@/adapters/backend";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RechargePage = () => {
  const [amount, setAmount] = useState<string>("");
  const [currency] = useState<string>("INR");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);
  
  const { wallet, loadWallet } = useChatStore();
  const { toast } = useToast();

  const handlePayment = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    if (amountNum < 10) {
      toast({
        title: "Minimum Amount",
        description: "Minimum recharge amount is ₹10",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create Razorpay order
      const orderResponse = await createOrder({
        amountInDisplay: amountNum,
        currency
      });

      console.log('Order created:', orderResponse);

      // Get Razorpay key from environment (will be added to config)
      const RAZORPAY_KEY_ID = 'rzp_test_dummy_key'; // This should come from env in production

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderResponse.amount_inr * 100, // Amount in paise
        currency: 'INR',
        name: 'ClearChat',
        description: 'Wallet Recharge',
        order_id: orderResponse.order_id,
        handler: function (response: any) {
          console.log('Payment successful:', response);
          setIsProcessing(false);
          setIsWaitingForConfirmation(true);
          setAmount("");
          
          toast({
            title: "Payment Successful!",
            description: "Your payment is being processed. Your wallet will be updated shortly.",
          });

          // Poll for wallet update
          setTimeout(() => {
            loadWallet();
            setIsWaitingForConfirmation(false);
          }, 3000);
        },
        prefill: {
          name: 'ClearChat User',
          email: 'user@clearchat.com'
        },
        theme: {
          color: '#F3B27B'
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
            toast({
              title: "Payment Cancelled",
              description: "You can try again anytime.",
              variant: "destructive"
            });
          }
        }
      };

      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Razorpay script not loaded');
      }

    } catch (error) {
      console.error('Payment initiation failed:', error);
      setIsProcessing(false);
      toast({
        title: "Payment Failed",
        description: "Unable to initiate payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const predefinedAmounts = [50, 100, 200, 500, 1000];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-full"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Recharge Wallet</h1>
        </motion.div>

        {/* Current Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-accent/10 to-brown/10 border-accent/20">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-foreground">₹{wallet.inr.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Amount Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Select</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {predefinedAmounts.map((value) => (
                  <Button
                    key={value}
                    variant={amount === value.toString() ? "default" : "outline"}
                    onClick={() => setAmount(value.toString())}
                    className="h-12"
                  >
                    ₹{value}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Custom Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom Amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  ₹
                </span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-12 text-lg"
                  min="10"
                  step="1"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Minimum: ₹10</Badge>
                <Badge variant="outline">Currency: {currency}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            onClick={handlePayment}
            disabled={!amount || parseFloat(amount) < 10 || isProcessing || isWaitingForConfirmation}
            className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={20} className="mr-2 animate-spin" />
                Opening Payment...
              </>
            ) : isWaitingForConfirmation ? (
              <>
                <RefreshCw size={20} className="mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard size={20} className="mr-2" />
                Pay ₹{amount || "0"} with Razorpay
              </>
            )}
          </Button>
        </motion.div>

        {/* Payment Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• Secure payments powered by Razorpay</p>
                <p>• Supports UPI, Cards, Net Banking & Wallets</p>
                <p>• Your wallet will be updated within seconds</p>
                <p>• All transactions are encrypted and secure</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default RechargePage;