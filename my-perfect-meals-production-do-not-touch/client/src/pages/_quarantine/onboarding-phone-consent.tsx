import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetUserPhone, useRequestPhoneCode, useVerifyPhoneCode, useSetSmsConsent } from "@/hooks/usePhone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function OnboardingPhoneConsent() {
  const userId = "demo-user"; // Replace with your actual auth/user context
  const [, navigate] = useLocation();
  
  const { data: phoneData, isLoading } = useGetUserPhone(userId);
  const requestCode = useRequestPhoneCode(userId);
  const verifyCode = useVerifyPhoneCode(userId);
  const setSmsConsent = useSetSmsConsent(userId);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<"phone" | "code" | "consent">("phone");

  useEffect(() => {
    if (phoneData) {
      if (phoneData.phoneE164) {
        setPhone(phoneData.phoneE164);
        if (phoneData.phoneVerified) {
          setStep("consent");
        } else {
          setStep("code");
        }
      }
    }
  }, [phoneData]);

  const handleSendCode = async () => {
    try {
      await requestCode.mutateAsync(phone);
      setStep("code");
    } catch (error) {
      console.error("Failed to send code:", error);
    }
  };

  const handleVerifyCode = async () => {
    try {
      await verifyCode.mutateAsync({ code });
      setStep("consent");
    } catch (error) {
      console.error("Failed to verify code:", error);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      await setSmsConsent.mutateAsync(consent);
      navigate("/onboarding/meal-reminders");
    } catch (error) {
      console.error("Failed to save consent:", error);
    }
  };

  const formatPhone = (value: string) => {
    // Basic US phone formatting
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  if (isLoading) {
    return <div className="p-4 max-w-md mx-auto">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">Phone & SMS Consent</h1>
      <p className="text-sm opacity-80 mb-4">
        We'll send meal reminders to your phone. Verify your number and choose your preferences.
      </p>

      {step === "phone" && (
        <>
          <Label htmlFor="phone" className="text-sm mb-1 block">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="(555) 123-4567"
            className="mb-4"
          />
          <Button 
            onClick={handleSendCode} 
            disabled={phone.length < 10 || requestCode.isPending}
            className="w-full"
          >
            {requestCode.isPending ? "Sending..." : "Send Verification Code"}
          </Button>
        </>
      )}

      {step === "code" && (
        <>
          <p className="text-sm mb-4">
            We sent a 6-digit code to {formatPhone(phone)}. Enter it below:
          </p>
          <Label htmlFor="code" className="text-sm mb-1 block">Verification Code</Label>
          <Input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="mb-4"
          />
          <Button 
            onClick={handleVerifyCode} 
            disabled={code.length !== 6 || verifyCode.isPending}
            className="w-full mb-2"
          >
            {verifyCode.isPending ? "Verifying..." : "Verify Code"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setStep("phone")}
            className="w-full"
          >
            Change Phone Number
          </Button>
        </>
      )}

      {step === "consent" && (
        <>
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox 
              id="sms-consent" 
              checked={consent}
              onCheckedChange={(checked) => setConsent(!!checked)}
            />
            <Label 
              htmlFor="sms-consent" 
              className="text-sm leading-5"
            >
              I agree to receive SMS meal reminders at {formatPhone(phone)}. 
              Reply STOP to opt out. Standard message rates apply.
            </Label>
          </div>
          <Button 
            onClick={handleSaveAndContinue} 
            disabled={setSmsConsent.isPending}
            className="w-full"
          >
            {setSmsConsent.isPending ? "Saving..." : "Save & Continue"}
          </Button>
        </>
      )}
    </div>
  );
}