import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate = ({ children }: AuthGateProps) => {
  const { user, loading, initialize } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      const cleanup = initialize();
      setHasError(false);
      return cleanup;
    } catch (error) {
      console.error('Auth initialization error:', error);
      setHasError(true);
    }
  }, [initialize]);

  useEffect(() => {
    if (!loading && !user && location.pathname !== '/signin') {
      navigate('/signin');
    }
  }, [user, loading, navigate, location.pathname]);

  // Loading state with app logo
  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-brand mx-auto">
            <span className="text-accent-foreground font-bold text-2xl">CC</span>
          </div>
          <div className="space-y-2">
            <div className="w-48 h-4 bg-muted animate-pulse rounded mx-auto" />
            <div className="w-32 h-3 bg-muted/70 animate-pulse rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (hasError) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Authentication Error</h2>
            <p className="text-sm text-muted-foreground">
              Failed to initialize authentication. Please try again.
            </p>
          </div>
          <Button
            onClick={() => {
              setHasError(false);
              window.location.reload();
            }}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== '/signin') {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
};

export default AuthGate;