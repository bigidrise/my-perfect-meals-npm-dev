import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, Save, X, Check } from "lucide-react";
import { useState } from "react";

interface BetaNameEditorProps {
  currentName?: string;
  onNameChange?: (name: string) => void;
}

export const BetaNameEditor = ({ 
  currentName = "Beta Tester", 
  onNameChange 
}: BetaNameEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(currentName);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = () => {
    onNameChange?.(tempName);
    setJustSaved(true);
    setIsEditing(false);
    // Reset success state after 2 seconds
    setTimeout(() => {
      setJustSaved(false);
    }, 2000);
  };

  const handleCancel = () => {
    setTempName(currentName);
    setIsEditing(false);
  };

  return (
    <Card className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-500" />
          Personalize Your Experience
        </CardTitle>
        <CardDescription>
          What would you like us to call you?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-lg text-gray-800 dark:text-gray-200">
                Hello, {currentName}! 👋
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                This is how we'll address you throughout the app
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Enter your preferred name"
              className="text-lg"
              autoFocus
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleSave}
                className={`flex-1 ${
                  justSaved 
                    ? "bg-green-500 hover:bg-green-600" 
                    : ""
                } transition-all duration-200`}
                disabled={justSaved}
              >
                {justSaved ? (
                  <><Check className="w-4 h-4 mr-1" />Saved ✓</>
                ) : (
                  <><Save className="w-4 h-4 mr-1" />Save</>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancel}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};