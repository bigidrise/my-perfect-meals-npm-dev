
import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function BarcodeScanButton({ onScan }: { onScan: (upc: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startScanning = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Back camera
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
    setError(null);
  };

  const handleManualEntry = () => {
    const barcode = prompt('Enter barcode number:');
    if (barcode) {
      onScan(barcode);
      toast({
        title: 'Barcode entered',
        description: `Looking up product: ${barcode}`,
      });
    }
  };

  if (!scanning) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={startScanning}
          className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
        >
          <Camera className="h-4 w-4 mr-2" />
          📷 Scan Barcode
        </Button>
        <Button
          onClick={handleManualEntry}
          variant="outline"
          className="rounded-xl"
        >
          Manual Entry
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-black/30 backdrop-blur-lg border-white/20 text-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Camera className="h-6 w-6" />
              Scan Barcode
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopScanning}
              className="text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            autoPlay
            playsInline
            muted
          />
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          )}

          <div className="text-center text-sm text-white/70">
            <p>Position the barcode in the camera view</p>
            <p className="text-xs mt-2">Tap below to enter barcode manually if scanner doesn't work</p>
          </div>

          <Button
            onClick={handleManualEntry}
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
          >
            Enter Barcode Manually
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
