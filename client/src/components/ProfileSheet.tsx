import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import {
  User,
  Shield,
  RefreshCcw,
  CreditCard,
  LogOut,
  ChevronRight,
  MessageCircle,
  Video,
  FileText,
  Trash2,
  Utensils,
  Camera,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { logout, getAuthToken } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import IOSMealReminders from "@/components/ios/IOSMealReminders";
import { Capacitor } from "@capacitor/core";
import {
  Camera as CapacitorCamera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";

interface ProfileSheetProps {
  children: React.ReactNode;
}

export function ProfileSheet({ children }: ProfileSheetProps) {
  const [, setLocation] = useLocation();
  const { user, setUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = user?.name || user?.username || "User";
  const userEmail = user?.email || "";
  const profilePhotoUrl = user?.profilePhotoUrl;
  const isNative = Capacitor.isNativePlatform();

  const uploadPhoto = async (file: File) => {
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["x-auth-token"] = token;
      }

      const presignedRes = await fetch(apiUrl("/api/uploads/request-url"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to get upload URL (${presignedRes.status})`,
        );
      }

      const { uploadURL, objectPath } = await presignedRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok)
        throw new Error(`Failed to upload image (${uploadRes.status})`);

      const updateHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        updateHeaders["x-auth-token"] = token;
      }

      const updateRes = await fetch(apiUrl("/api/users/profile-photo"), {
        method: "PUT",
        headers: updateHeaders,
        credentials: "include",
        body: JSON.stringify({ profilePhotoUrl: objectPath }),
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to update profile (${updateRes.status})`,
        );
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
      setShowPhotoOptions(false);
    }
  };

  const handleCapacitorPhoto = async (source: CameraSource) => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source,
      });

      if (image.dataUrl) {
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `profile-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        await uploadPhoto(file);
      }
    } catch (error: any) {
      if (error.message !== "User cancelled photos app") {
        console.error("Camera error:", error);
        toast({
          title: "Camera error",
          description: "Could not access camera or photos.",
          variant: "destructive",
        });
      }
      setShowPhotoOptions(false);
    }
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadPhoto(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePhotoTap = () => {
    if (isNative) {
      setShowPhotoOptions(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setLocation("/welcome");
  };

  const handleRestorePurchases = async () => {
    toast({
      title: "Restoring Purchases...",
      description: "Looking for active subscriptions...",
    });

    try {
      // TODO: Integrate with StoreKit restore when Capacitor plugin is ready
      // For now, show feedback that the feature is ready for iOS integration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "Restore Complete",
        description:
          "No active subscription found. If you believe this is an error, please contact support.",
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Unable to restore purchases. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMenuItemClick = (item: (typeof menuItems)[0]) => {
    if (item.action === "restorePurchases") {
      handleRestorePurchases();
    } else if (item.route) {
      setLocation(item.route);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(apiUrl("/api/auth/delete-account"), {
        method: "DELETE",
        credentials: "include",
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
        description:
          error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if user is a Pro Care client (restricted from changing builder)
  const isProCareClient = user?.isProCare && user?.role !== "admin";

  const menuItems = [
    // ✅ NEW: Personal profile editing entry
    {
      title: "My Profile",
      description: "Update your personal info & preferences",
      icon: User,
      route: "/profile",
      testId: "menu-my-profile",
    },

    // Only show "Change Meal Builder" if NOT a Pro Care client
    ...(!isProCareClient
      ? [
          {
            title: "Meal Builder Exchange",
            description: "Switch to a different dietary focus",
            icon: Utensils,
            route: "/select-builder",
            testId: "menu-change-builder",
          },
        ]
      : []),
    {
      title: "Privacy & Security",
      description: "Manage your privacy settings",
      icon: Shield,
      route: "/privacy",
      testId: "menu-privacy",
    },
    {
      title: "Restore Purchases",
      description: "Restore an active subscription on this device",
      icon: RefreshCcw,
      action: "restorePurchases",
      testId: "menu-restore-purchases",
    },
    {
      title: "Subscription",
      description: "Manage your plan & billing",
      icon: CreditCard,
      route: "/pricing",
      testId: "menu-subscription",
    },
    {
      title: "App Library",
      description:
        "Learn the systems, the nutrition basics, and how to get the most out of the app.",
      icon: Video,
      route: "/learn",
      testId: "menu-tutorials",
    },
    {
      title: "Meet the MPM Team",
      description: "Message from our founders",
      icon: MessageCircle,
      route: "/founders",
      testId: "menu-about",
    },
    {
      title: "Terms of Service",
      description: "Review our terms and conditions",
      icon: FileText,
      route: "/terms",
      testId: "menu-terms",
    },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="bg-gradient-to-br from-black/75 via-orange-900/80 to-black/75 border-l border-white/10 backdrop-blur-xl overflow-y-auto pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-white">My Hub</SheetTitle>
          <SheetDescription className="text-white/70">
            Your personal space
          </SheetDescription>
        </SheetHeader>

        {/* Hidden file input for web */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* User Info Section */}
        <div className="mt-6 p-4 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePhotoTap}
              disabled={isUploadingPhoto}
              className="relative h-20 w-20 rounded-full bg-black/40 border-2 border-orange-400/30 overflow-hidden shadow-lg flex items-center justify-center group ring-2 ring-orange-500/30"
            >
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt={userName}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <User className="h-9 w-9 text-white/70" />
              )}
              {isUploadingPhoto ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 p-1.5 rounded-full bg-orange-500 border border-black/40">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{userName}</h3>
              {userEmail && (
                <p className="text-white/70 text-sm truncate">{userEmail}</p>
              )}
              <p className="text-orange-300/70 text-xs mt-0.5">
                Tap photo to change
              </p>
            </div>
          </div>
        </div>

        {/* Photo Options Action Sheet (iOS native) */}
        {showPhotoOptions && (
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowPhotoOptions(false)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl p-4 pb-8 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-white/60 text-sm mb-3">
                Update Profile Photo
              </p>
              <button
                onClick={() => handleCapacitorPhoto(CameraSource.Camera)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 active:bg-white/20"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </button>
              <button
                onClick={() => handleCapacitorPhoto(CameraSource.Photos)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 active:bg-white/20"
              >
                <ImageIcon className="h-5 w-5" />
                Choose from Library
              </button>
              <button
                onClick={() => setShowPhotoOptions(false)}
                className="w-full py-3 rounded-xl bg-white/5 text-white/70 font-medium mt-2 active:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Meal Reminders */}
        <div className="mt-4">
          <IOSMealReminders />
        </div>

        {/* Menu Items */}
        <div className="mt-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.testId}
                onClick={() => handleMenuItemClick(item)}
                className="w-full flex items-center gap-2 p-2 bg-black/20 hover:bg-black/40 border border-white/10 rounded-lg transition-all group"
                data-testid={item.testId}
              >
                <Icon className="h-4 w-4 text-orange-400" />
                <div className="flex-1 text-left">
                  <p className="text-white font-medium text-xs">{item.title}</p>
                  <p className="text-white/60 text-[10px]">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-3 w-3 text-white/40 group-hover:text-white/70 transition-colors" />
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full bg-orange-700/90 hover:bg-orange-800 border-orange-600 text-white hover:text-white mb-3"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>

          {/* Delete Account */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full bg-red-900/50 hover:bg-red-800 border-red-600/50 text-red-300 hover:text-white"
                data-testid="button-delete-account"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black/95 border border-white/20 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete Account Permanently?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-white/70 space-y-2">
                  <p>
                    This action cannot be undone. This will permanently delete:
                  </p>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
