import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Skeleton } from '@/components/common/Skeleton';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate = ({ children }: AuthGateProps) => {
  const { user, loading, initialize } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    if (!loading && !user && location.pathname !== '/signin') {
      navigate('/signin');
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-10 w-full" />
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