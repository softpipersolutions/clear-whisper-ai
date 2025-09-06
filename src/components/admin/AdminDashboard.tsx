import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/common/Skeleton";
import InlineBanner from "@/components/common/InlineBanner";
import { useAdminStore } from "@/store/admin";
import { IndianRupee, Users, TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  prefix = "₹", 
  isLoading, 
  className = "" 
}: {
  title: string;
  value: number;
  icon: any;
  prefix?: string;
  isLoading: boolean;
  className?: string;
}) => {
  if (isLoading) {
    return <SkeletonCard className="h-24" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`rounded-2xl shadow-brand hover:shadow-brand-hover transition-shadow duration-200 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{title}</p>
              <p className="text-2xl font-bold text-foreground">
                {prefix}{typeof value === 'number' ? value.toFixed(2) : value}
              </p>
            </div>
            <Icon size={24} className="text-accent" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const {
    stats,
    transactions,
    users,
    isLoadingStats,
    isLoadingTransactions,
    isLoadingUsers,
    statsError,
    transactionsError,
    usersError,
    transactionTypeFilter,
    fetchAdminStats,
    fetchAdminTransactions,
    fetchAdminUsers,
    setTransactionTypeFilter,
    clearErrors
  } = useAdminStore();

  useEffect(() => {
    // Fetch all admin data on component mount
    fetchAdminStats();
    fetchAdminTransactions(true);
    fetchAdminUsers();
  }, [fetchAdminStats, fetchAdminTransactions, fetchAdminUsers]);

  const handleRefresh = () => {
    clearErrors();
    fetchAdminStats();
    fetchAdminTransactions(true);
    fetchAdminUsers();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor platform performance and user activity</p>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </motion.div>

        {/* Error Banners */}
        {statsError && (
          <InlineBanner
            type="error"
            title="Stats Error"
            message={statsError}
            onRetry={fetchAdminStats}
            onDismiss={clearErrors}
          />
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Total Users"
            value={stats?.totalUsers || 0}
            icon={Users}
            prefix=""
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Total Wallet Balance"
            value={stats?.totalWalletINR || 0}
            icon={IndianRupee}
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Total Recharges"
            value={stats?.totalRechargesINR || 0}
            icon={TrendingUp}
            isLoading={isLoadingStats}
            className="border-green-200 bg-green-50/50"
          />
          <StatCard
            title="Total Deductions"
            value={stats?.totalDeductionsINR || 0}
            icon={TrendingDown}
            isLoading={isLoadingStats}
            className="border-red-200 bg-red-50/50"
          />
          <StatCard
            title="Raw Costs"
            value={stats?.totalRawCostINR || 0}
            icon={DollarSign}
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Platform Profit"
            value={stats?.profitINR || 0}
            icon={TrendingUp}
            isLoading={isLoadingStats}
            className="border-accent bg-accent/10"
          />
        </div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-2xl shadow-brand">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Users & Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersError && (
                <InlineBanner
                  type="error"
                  title="Users Error"
                  message={usersError}
                  onRetry={fetchAdminUsers}
                  className="mb-4"
                />
              )}
              
              {isLoadingUsers ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonText key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Wallet Balance</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user, index) => (
                        <TableRow key={user.id} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.country}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-accent">
                              ₹{user.wallet_balance_inr.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-2xl shadow-brand">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp size={20} />
                  Recent Transactions
                </CardTitle>
                <Select value={transactionTypeFilter || "all"} onValueChange={(value) => setTransactionTypeFilter(value === "all" ? null : value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="recharge">Recharges</SelectItem>
                    <SelectItem value="deduction">Deductions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsError && (
                <InlineBanner
                  type="error"
                  title="Transactions Error"
                  message={transactionsError}
                  onRetry={() => fetchAdminTransactions(true)}
                  className="mb-4"
                />
              )}
              
              {isLoadingTransactions ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <SkeletonText key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Raw Cost</TableHead>
                        <TableHead>Deducted Cost</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction, index) => (
                        <TableRow key={transaction.id} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell>
                            <Badge variant={transaction.type === 'recharge' ? 'default' : 'secondary'}>
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {transaction.user_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{transaction.amount_inr.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {transaction.raw_cost_inr ? `₹${transaction.raw_cost_inr.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>
                            {transaction.deducted_cost_inr ? (
                              <span className="text-accent font-semibold">
                                ₹{transaction.deducted_cost_inr.toFixed(2)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;