import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User,
  Activity,
  Settings,
  ChefHat,
  LogOut,
  Bell,
  Shield,
  Heart,
  TrendingUp,
  Target,
  CreditCard,
  RotateCcw,
  Trash2,
  LifeBuoy,
  Camera,
  Loader2,
} from "lucide-react";
import { logout, getAuthToken } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import EmotionAIFooter from "@/components/EmotionAIFooter";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, setUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Profile | My Perfect Meals";
  }, []);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("Not authenticated");

      const presignedRes = await fetch(apiUrl("/api/uploads/request-url"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await presignedRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      const updateRes = await fetch(apiUrl("/api/users/profile-photo"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({ profilePhotoUrl: objectPath }),
      });

      if (!updateRes.ok) {
        throw new Error("Failed to update profile photo");
      }

      await refreshUser();

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(apiUrl("/api/auth/delete-account"), {
        method: "DELETE",
        headers: {
          "x-auth-token": token,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete account");
      }

      logout();
      setUser(null);
      setLocation("/welcome");

      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted.",
      });
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const userName = user?.name || "User";
  const userEmail = user?.email || "";
  const profilePhotoUrl = user?.profilePhotoUrl;

  const profileSections = [
    {
      title: "My Biometrics",
      description: "Track your health metrics and progress",
      icon: Activity,
      route: "/my-biometrics",
      testId: "profile-biometrics",
    },
    {
      title: "ProCare Support",
      description: "Connect with nutrition experts",
      icon: ChefHat,
      route: "/pro-team",
      testId: "profile-procare",
    },
    {
      title: "Account Settings",
      description: "Manage your account preferences",
      icon: Settings,
      route: "/settings",
      testId: "profile-settings",
    },
    {
      title: "Notifications",
      description: "Control your notification preferences",
      icon: Bell,
      route: "/notifications",
      testId: "profile-notifications",
    },
    {
      title: "Privacy & Security",
      description: "Manage your privacy settings",
      icon: Shield,
      route: "/privacy",
      testId: "profile-privacy",
    },
    {
      title: "Subscription",
      description: "Manage your plan & billing",
      icon: CreditCard,
      route: "/pricing",
      testId: "profile-subscription",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-20">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="profile-photo-input"
              />
              <label
                htmlFor="profile-photo-input"
                className="cursor-pointer block"
              >
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-primary shadow-lg">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-8 w-8 text-white" />
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-purple-600 border-2 border-black/40">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </label>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {userName}
              </h1>
              {userEmail && (
                <p className="text-sm text-white/90">
                  {userEmail}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="h-6 w-6 text-white" />
              <div>
                <p className="text-sm text-white/90">Daily Goal</p>
                <p className="text-lg font-bold text-white">75%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-white" />
              <div>
                <p className="text-sm text-white/90">Streak</p>
                <p className="text-lg font-bold text-white">7 days</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="h-6 w-6 text-white" />
              <div>
                <p className="text-sm text-white/90">Favorites</p>
                <p className="text-lg font-bold text-white">12</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Sections */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Manage Your Account
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {profileSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.testId}
                  className="cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-purple-400/50 rounded-2xl shadow-md"
                  onClick={() => setLocation(section.route)}
                  data-testid={section.testId}
                >
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Icon className="h-8 w-8 md:h-10 md:w-10 text-white" />
                      <h3 className="text-base md:text-lg font-semibold text-white">
                        {section.title}
                      </h3>
                      <p className="text-xs md:text-sm text-white/90 leading-snug">
                        {section.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Contact Support */}
        <Card className="mt-6 bg-black/30 backdrop-blur-lg border border-white/10">
          <CardContent className="p-4">
            <a
              href="mailto:support@myperfectmeals.com"
              className="flex items-center w-full text-white hover:text-lime-400 transition-colors"
              data-testid="button-contact-support"
            >
              <LifeBuoy className="mr-2 h-5 w-5" />
              Contact Support
            </a>
          </CardContent>
        </Card>

        {/* Tutorial Reset */}
        <Card className="mt-6 bg-black/30 backdrop-blur-lg border border-white/10">
          <CardContent className="p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:text-white hover:bg-purple-900/20"
              onClick={() => {
                // Clear coach mode to trigger WelcomeGate again
                localStorage.removeItem("coachMode");
                // Redirect to home which will show WelcomeGate
                setLocation("/");
              }}
              data-testid="button-reset-tutorial"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Reset Tutorial & Coach Mode
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="mt-6 bg-black/30 backdrop-blur-lg border border-white/10">
          <CardContent className="p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:text-white hover:bg-red-900/20"
              onClick={() => {
                logout();
                setUser(null);
                setLocation("/welcome");
              }}
              data-testid="button-signout"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="mt-6 bg-black/30 backdrop-blur-lg border border-red-500/30">
          <CardContent className="p-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  data-testid="button-delete-account"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black/95 border border-white/20 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Account Permanently?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70 space-y-2">
                    <p>This action cannot be undone. This will permanently delete:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                      <li>Your account and profile information</li>
                      <li>All meal plans and saved recipes</li>
                      <li>Biometrics and health tracking data</li>
                      <li>Subscription and payment history</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="button-confirm-delete"
                  >
                    {isDeleting ? "Deleting..." : "Delete My Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Emotion AI Footer */}
      <EmotionAIFooter />
    </div>
  );
}
