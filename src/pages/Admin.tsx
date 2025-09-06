import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";

const Admin = () => {
  const { isAdmin } = useAuthStore();
  
  useEffect(() => {
    document.title = "Admin Dashboard - ClearChat";
  }, []);

  if (!isAdmin) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Admins only</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-screen bg-background"
    >
      <AdminDashboard />
    </motion.div>
  );
};

export default Admin;