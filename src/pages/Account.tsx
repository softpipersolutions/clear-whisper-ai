import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useFxStore } from "@/store/fx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Globe, LogOut, Save, Loader2 } from "lucide-react";
import InlineBanner from "@/components/common/InlineBanner";
import { supabase } from "@/integrations/supabase/client";

const Account = () => {
  const { user, signOut, updateProfile } = useAuthStore();
  const { fetchFxRate } = useFxStore();
  const navigate = useNavigate();
  
  const [preferredCurrency, setPreferredCurrency] = useState(
    user?.user_metadata?.preferred_currency || 'INR'
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currencies = [
    { value: 'INR', label: '🇮🇳 Indian Rupee (INR)' },
    { value: 'USD', label: '🇺🇸 US Dollar (USD)' },
    { value: 'EUR', label: '🇪🇺 Euro (EUR)' },
    { value: 'GBP', label: '🇬🇧 British Pound (GBP)' },
    { value: 'JPY', label: '🇯🇵 Japanese Yen (JPY)' },
    { value: 'CAD', label: '🇨🇦 Canadian Dollar (CAD)' },
    { value: 'AUD', label: '🇦🇺 Australian Dollar (AUD)' }
  ];

  useEffect(() => {
    if (!user) {
      navigate('/signin');
    }
  }, [user, navigate]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    setMessage(null);
    
    try {
      // Update user metadata via Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          preferred_currency: preferredCurrency
        }
      });

      if (authError) {
        throw authError;
      }

      // Update the profile in our public.profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ preferred_currency: preferredCurrency })
        .eq('id', user.id);

      if (profileError) {
        console.warn('Profile update error:', profileError);
        // Don't throw - auth metadata is the source of truth
      }

      // Update local auth store
      if (updateProfile) {
        updateProfile({ preferred_currency: preferredCurrency });
      }

      // Fetch new FX rate if currency changed
      if (preferredCurrency !== 'INR') {
        fetchFxRate(preferredCurrency);
      }

      setMessage({
        type: 'success',
        text: 'Currency preference updated successfully!'
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update currency preference. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const hasChanges = preferredCurrency !== (user?.user_metadata?.preferred_currency || 'INR');

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-brand sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/chat')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft size={16} />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Account Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-2xl mx-auto space-y-6" id="main-content">
        {/* Success/Error Messages */}
        {message && (
          <InlineBanner
            type={message.type === 'success' ? 'info' : 'error'}
            title={message.type === 'success' ? 'Success' : 'Error'}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        )}

        {/* Profile Information */}
        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-foreground font-medium">{user.email}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">User ID</label>
              <p className="text-xs text-muted-foreground font-mono break-all">{user.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Currency Preferences */}
        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Currency Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Preferred Currency
              </label>
              <Select value={preferredCurrency} onValueChange={setPreferredCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                This affects how prices and wallet balances are displayed throughout the app.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={!hasChanges || isUpdating}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSignOut}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Account;