import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExportPhysicianReportButtonProps {
  mealPlan: Array<{
    name: string;
    description: string;
    slot?: string;
    protein: number;
    carbs: number;
    fat: number;
    kcal: number;
    ingredients: string[];
    medicalBadges?: Array<{
      type: string;
      reason: string;
    }>;
  }>;
  protocol?: string;
  userId: string;
  className?: string;
}

export function ExportPhysicianReportButton({
  mealPlan,
  protocol,
  userId,
  className,
}: ExportPhysicianReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [shareableLink, setShareableLink] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const getUserHealthProfile = () => {
    // Get user's health profile from localStorage
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      return {
        hasDiabetes: false,
        allergies: [],
        medicalConditions: [],
        medications: [],
        dietaryRestrictions: [],
      };
    }

    const user = JSON.parse(userStr);
    return {
      hasDiabetes: user.hasDiabetes || false,
      diabetesType: user.diabetesType,
      allergies: user.allergies || [],
      medicalConditions: user.healthConditions || [],
      medications: user.medications || [],
      dietaryRestrictions: user.dietaryRestrictions || [],
    };
  };

  const handleExport = async () => {
    if (mealPlan.length === 0) {
      toast({
        title: "No Meal Plan",
        description: "Please generate a meal plan before exporting for physician review.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const healthProfile = getUserHealthProfile();
      const userStr = localStorage.getItem("currentUser");
      const user = userStr ? JSON.parse(userStr) : {};

      const data = await apiRequest("/api/physician-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          patientName: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : undefined,
          healthProfile,
          mealPlan,
          protocol,
          clinicalNotes: `Generated from Medical Diets Hub on ${new Date().toLocaleDateString()}`,
        }),
      });
      setShareableLink(data.shareableLink);
      setAccessCode(data.report.accessCode);
      setShowDialog(true);

      toast({
        title: "Report Generated!",
        description: "Your physician report is ready to share.",
      });
    } catch (error) {
      console.error("Error generating physician report:", error);
      toast({
        title: "Error",
        description: "Failed to generate physician report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <>
      <Button
        onClick={handleExport}
        disabled={isGenerating || mealPlan.length === 0}
        className={className}
        variant="outline"
        data-testid="button-export-physician-report"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Export for Physician Review
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-6 h-6 text-purple-600" />
              Physician Report Generated
            </DialogTitle>
            <DialogDescription>
              Share this link with your healthcare provider for professional review
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Access Code</h4>
              <p className="text-2xl font-mono font-bold text-purple-600 tracking-wider">
                {accessCode}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Your doctor can use this code to access the report
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Shareable Link</h4>
                <Button
                  onClick={copyToClipboard}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  data-testid="button-copy-link"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-white border border-gray-300 rounded p-3 text-sm text-gray-700 break-all font-mono">
                {shareableLink}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                What's Included in This Report?
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Your health profile (diabetes status, allergies, medical conditions)</li>
                <li>Complete meal plan with nutritional breakdown</li>
                <li>Medical compatibility badges for each meal</li>
                <li>Clinical protocol information</li>
                <li>Daily nutritional totals</li>
              </ul>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>✓ This report is secure and can only be accessed with the access code</p>
              <p>✓ The report tracks how many times it has been viewed</p>
              <p>✓ You can generate new reports anytime with updated meal plans</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => window.open(shareableLink, "_blank")}
                variant="default"
                className="flex-1"
                data-testid="button-view-report"
              >
                View Report
              </Button>
              <Button
                onClick={() => setShowDialog(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-close-dialog"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
