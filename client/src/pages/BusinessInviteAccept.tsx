import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, CheckCircle, XCircle, UserCheck } from "lucide-react";

interface InviteInfo {
  email: string;
  role: string;
  businessName: string;
  expiresAt: string;
}

export default function BusinessInviteAccept() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedBusiness, setAcceptedBusiness] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/business/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setFetchError(data.error);
        } else {
          setInvite(data);
        }
      })
      .catch(() => setFetchError("Could not load invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to auth with return path
      setLocation(`/auth?redirect=/business/join/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/business/invite/${token}/accept`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not accept invite", description: data.error, variant: "destructive" });
        return;
      }
      setAcceptedBusiness(data.businessName);
      setAccepted(true);
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        <h2 className="text-white text-2xl font-bold mb-2">You're In!</h2>
        <p className="text-white/70 text-base mb-1">
          Welcome to <span className="text-white font-semibold">{acceptedBusiness}</span>
        </p>
        <p className="text-white/50 text-sm mb-8">
          Your account now has Clinical Business access.
        </p>
        <button
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
          onClick={() => setLocation("/dashboard")}
        >
          Go to My Dashboard
        </button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <XCircle className="w-14 h-14 text-red-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Invitation Unavailable</h2>
        <p className="text-white/60 text-sm mb-6 max-w-xs">{fetchError}</p>
        <button
          className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
          onClick={() => setLocation("/")}
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!invite) return null;

  const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);
  const expiryDate = new Date(invite.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Icon + Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4">
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-white text-2xl font-bold mb-1">Team Invitation</h1>
          <p className="text-white/50 text-sm">My Perfect Meals</p>
        </div>

        {/* Invite Card */}
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">Team</span>
            <span className="text-white font-semibold text-sm">{invite.businessName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">Invited as</span>
            <span className="text-blue-300 font-semibold text-sm">{roleLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">Expires</span>
            <span className="text-white/70 text-sm">{expiryDate}</span>
          </div>
        </div>

        <p className="text-white/50 text-xs text-center mb-5">
          Joining gives your account full Clinical-level access — AI meal generation, biometric tracking, and all professional tools.
        </p>

        {!user && (
          <div className="bg-blue-900/30 border border-blue-500/20 rounded-xl p-3 mb-4 text-center">
            <p className="text-blue-300 text-sm">
              You'll need to log in or create an account to accept this invitation.
            </p>
          </div>
        )}

        <button
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Joining…</>
          ) : (
            <><UserCheck className="w-5 h-5" /> {user ? "Accept & Join Team" : "Log In to Accept"}</>
          )}
        </button>
      </div>
    </div>
  );
}
