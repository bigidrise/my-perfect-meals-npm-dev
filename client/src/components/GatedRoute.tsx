import { isFeatureEnabled, getGatedMessage, type GatedFeature } from '@/lib/productionGates';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChefHat, ArrowLeft } from 'lucide-react';

interface GatedRouteProps {
  feature: GatedFeature;
  children: React.ReactNode;
}

export function GatedRoute({ feature, children }: GatedRouteProps) {
  const { user } = useAuth();
  
  const isEnabled = isFeatureEnabled(feature, user?.email);
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  const message = getGatedMessage(feature);
  
  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mb-6">
        <ChefHat className="w-10 h-10 text-amber-400" />
      </div>
      
      <h1 className="text-2xl font-bold text-white mb-3">
        Coming Soon
      </h1>
      
      <p className="text-zinc-400 max-w-sm mb-8">
        {message}
      </p>
      
      <Button 
        onClick={handleGoBack}
        className="bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 hover:border-white/30 shadow-lg"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Go Back
      </Button>
    </div>
  );
}

export function withGate<P extends object>(
  Component: React.ComponentType<P>,
  feature: GatedFeature
) {
  return function GatedComponent(props: P) {
    return (
      <GatedRoute feature={feature}>
        <Component {...props} />
      </GatedRoute>
    );
  };
}
