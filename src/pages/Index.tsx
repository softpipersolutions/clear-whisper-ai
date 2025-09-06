import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { motion } from "framer-motion";
import { MessageSquare, Zap, Shield, Users, LogIn } from "lucide-react";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    // Redirect authenticated users to chat
    if (user) {
      navigate('/chat');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: MessageSquare,
      title: "Smart Conversations",
      description: "Engage with advanced AI models that understand context and provide intelligent responses."
    },
    {
      icon: Zap,
      title: "Pay Per Use",
      description: "Only pay for what you use with transparent pricing and real-time cost estimation."
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your conversations are encrypted and secure. We prioritize your privacy above all."
    },
    {
      icon: Users,
      title: "Multi-Model Support",
      description: "Choose from various AI models optimized for different types of conversations and tasks."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
              Welcome to{" "}
              <span className="text-accent">ClearChat</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Experience the next generation of AI conversations with transparent pricing, 
              secure interactions, and powerful models at your fingertips.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => navigate('/signin')}
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold rounded-xl shadow-brand transition-all duration-200 hover:shadow-brand-hover"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/signin')}
                variant="outline"
                size="lg" 
                className="px-8 py-3 text-lg font-semibold rounded-xl border-2 border-border hover:bg-secondary/20"
              >
                Get Started
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-panel/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose ClearChat?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for modern conversations with cutting-edge AI technology and user-centric design.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
              >
                <Card className="h-full border-border shadow-brand hover:shadow-brand-hover transition-all duration-200">
                  <CardHeader>
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-accent" />
                    </div>
                    <CardTitle className="text-xl font-semibold text-foreground">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to Start Chatting?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of users who trust ClearChat for their AI conversations.
            </p>
            <Button 
              onClick={() => navigate('/signin')}
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-lg font-semibold rounded-xl shadow-brand transition-all duration-200 hover:shadow-brand-hover"
            >
              Get Started Now
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;