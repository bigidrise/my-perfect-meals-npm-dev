
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface FeatureDisabledNoticeProps {
  featureName: string;
  reason?: string;
}

export const FeatureDisabledNotice: React.FC<FeatureDisabledNoticeProps> = ({ 
  featureName, 
  reason = "This feature is temporarily disabled during alpha testing" 
}) => {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600" />
        <div>
          <h4 className="font-medium text-yellow-800">{featureName} Unavailable</h4>
          <p className="text-sm text-yellow-700">{reason}</p>
        </div>
      </CardContent>
    </Card>
  );
};
