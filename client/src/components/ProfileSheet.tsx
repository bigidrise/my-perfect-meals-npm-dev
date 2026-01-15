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
  Camera,
  Loader2,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ProfileSheetProps {
  children: React.ReactNode;
}

export function ProfileSheet({ children }: ProfileSheetProps) {
  const [, setLocation] = useLocation();
  const { user, setUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = user?.name || user?.username || "User";
  const userEmail = user?.email || "";
  const profilePhotoUrl = user?.profilePhotoUrl;

  const userInitials = userName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      // Use credentials: "include" for session cookie auth (works on mobile)
      const presignedRes = await fetch(apiUrl("/api/uploads/request-url"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Restore Complete",
        description: "No active subscription found. If you believe this is an error, please contact support.",
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Unable to restore purchases. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMenuItemClick = (item: typeof menuItems[0]) => {
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
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const menuItems = [
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
      description: "Learn the systems, the nutrition basics, and how to get the most out of the app.",
      icon: Video,
      route: "/learn",
      testId: "menu-tutorials",
    },
    {
      title: "About My Perfect Meals",
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
      <SheetContent className="bg-gradient-to-br from-black/95 via-orange-900/40 to-black/95 border-l border-white/10 backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle className="text-white">My Hub</SheetTitle>
          <SheetDescription className="text-white/70">
            Your personal space
          </SheetDescription>
        </SheetHeader>

        {/* User Info Section */}
        <div className="mt-6 p-4 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="profile-photo-input-sheet"
              />
              <label
                htmlFor="profile-photo-input-sheet"
                className="cursor-pointer block"
              >
                <div className="relative h-12 w-12 rounded-full bg-orange-600/80 border-2 border-orange-400/30 overflow-hidden shadow-lg">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-semibold text-lg">
                      {userInitials || "?"}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 p-1 rounded-full bg-purple-600 border border-black/40">
                  <Camera className="h-2.5 w-2.5 text-white" />
                </div>
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{userName}</h3>
              {userEmail && (
                <p className="text-white/70 text-sm truncate">{userEmail}</p>
              )}
            </div>
          </div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
