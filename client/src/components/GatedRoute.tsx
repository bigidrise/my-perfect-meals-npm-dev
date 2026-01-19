import { isFeatureEnabled, getGatedMessage, type GatedFeature } from '@/lib/productionGates';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChefHat, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface GatedRouteProps {
  feature: GatedFeature;
  children: React.ReactNode;
}

export function GatedRoute({ feature, children }: GatedRouteProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const isEnabled = isFeatureEnabled(feature, user?.email);
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  const message = getGatedMessage(feature);
  
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
        variant="outline" 
        onClick={() => setLocation('/')}
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
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
