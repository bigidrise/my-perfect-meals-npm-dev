import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CombinedZipLocationControlProps {
  zipCode: string;
  onZipChange: (zip: string) => void;
  className?: string;
}

export default function CombinedZipLocationControl({
  zipCode,
  onZipChange,
  className = "",
}: CombinedZipLocationControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(zipCode);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setInputValue(zipCode);
  }, [zipCode]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await apiRequest(
            "/api/restaurants/reverse-geocode",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
            }
          ) as { zipCode?: string };

          if (response.zipCode) {
            onZipChange(response.zipCode);
            setInputValue(response.zipCode);
            setIsOpen(false);
            toast({
              title: "Location found",
              description: `ZIP Code: ${response.zipCode}`,
            });
          } else {
            toast({
              title: "Could not find ZIP",
              description: "Could not get ZIP code for your location.",
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "Location error",
            description: "Could not get ZIP code for your location.",
            variant: "destructive",
          });
        } finally {
          setIsGettingLocation(false);
        }
      },
      () => {
        setIsGettingLocation(false);
        toast({
          title: "Location access denied",
          description: "Please enable location access or enter ZIP manually.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleInputChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 5);
    setInputValue(cleaned);
  };

  const handleConfirm = () => {
    if (inputValue.length === 5) {
      onZipChange(inputValue);
      setIsOpen(false);
    } else if (inputValue.length > 0) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirm();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  if (isOpen) {
    return (
      <div className={`bg-white/10 rounded-lg p-3 space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            placeholder="Enter ZIP code"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/50"
            maxLength={5}
          />
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={inputValue.length !== 5}
            className="bg-green-600 hover:bg-green-700 text-white px-4"
          >
            Set
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="text-white/70 hover:text-white px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          onClick={handleUseLocation}
          disabled={isGettingLocation}
          variant="outline"
          className="w-full border-white/30 text-white hover:bg-white/10"
        >
          {isGettingLocation ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4 mr-2" />
              Use my current location
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => setIsOpen(true)}
      className={`w-full justify-start bg-white/10 hover:bg-white/20 text-white border border-white/30 ${className}`}
    >
      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
      {zipCode ? (
        <span>ZIP: {zipCode}</span>
      ) : (
        <span className="text-white/70">Tap to set ZIP code or use location</span>
      )}
    </Button>
  );
}
