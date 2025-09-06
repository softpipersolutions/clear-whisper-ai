import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/store/admin";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { Shield, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const Admin = () => {
  const { isAdmin, setIsAdmin } = useAdminStore();

  // For demo purposes, we'll add a button to toggle admin access
  // In production, this would be determined by authentication and user roles
  useEffect(() => {
    // Check if user should have admin access (mock for now)
    // In production, this would check JWT claims or user roles from Supabase Auth
    const mockAdminCheck = localStorage.getItem('mock_admin') === 'true';
    setIsAdmin(mockAdminCheck);
  }, [setIsAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Shield size={32} className="text-destructive" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
                <p className="text-muted-foreground">
                  This area is reserved for administrators only. Please contact your system administrator if you believe you should have access.
                </p>
              </div>

              <div className="space-y-3">
                {/* Demo button - remove in production */}
                <Button
                  onClick={() => {
                    localStorage.setItem('mock_admin', 'true');
                    setIsAdmin(true);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Demo: Grant Admin Access
                </Button>
                
                <Button
                  onClick={() => window.history.back()}
                  variant="ghost"
                  className="w-full"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return <AdminDashboard />;
};

export default Admin;