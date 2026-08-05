import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useOrgFlag } from "@/contexts/OrgContext";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Users,
  UserPlus,
  Settings,
  CreditCard,
  HelpCircle,
  Rocket,
  CheckCircle,
  Building2,
  GraduationCap,
  Heart,
  Shield,
  LogOut,
  Clock,
  Briefcase,
  Star,
  Zap,
  ArrowRight,
  History,
} from "lucide-react";
import { NarrationBar } from "@/components/NarrationBar";
import { getAuthHeaders } from "@/lib/auth";

const POLICY_NAMES: Record<string, string> = {
  org_only: "Organization Clients Only",
  allowed_with_disclosure: "Personal Clients Allowed — With Disclosure",
  allowed: "Personal Clients Allowed",
};

interface PolicyHistoryItem {
  id: string;
  old_policy: string | null;
  new_policy: string;
  changed_at: string;
  changed_by_name: string | null;
  changed_by_email: string | null;
}

export default function OrganizationSuccessCenter() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const showMarketplace = useOrgFlag("partnerMarketplace");
  const [expandedId, setExpandedId] = useState<string | null>("welcome");
  const [policyHistory, setPolicyHistory] = useState<PolicyHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadHistory = () => {
    if (historyLoaded || historyLoading) return;
    setHistoryLoading(true);
    fetch("/api/business/policy-history", {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.history) setPolicyHistory(data.history);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true))
      .finally(() => setHistoryLoading(false));
  };

  const toggle = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next === "policy_history") loadHistory();
  };

  const modules = [
    {
      id: "marketplace",
      icon: <Users className="w-5 h-5 text-orange-400" />,
      title: "Coach Marketplace",
      subtitle: showMarketplace ? "Enabled for your organization." : "Disabled for your organization.",
      narration: showMarketplace
        ? "The MPM Coach Marketplace is available to your organization. Members can browse and hire from the full roster of MPM-certified professionals."
        : "Your organization manages its own coaches and trainers. The MPM public Coach Marketplace is hidden from your team members — they work within your organization's professional roster instead.",
      content: showMarketplace ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-white text-sm">The MPM Coach Marketplace is active for your organization.</p>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">
            Your team members can browse, hire, and message coaches from the full MPM marketplace inside the app.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <p className="text-white text-sm font-semibold">Marketplace Hidden</p>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">
            Your organization uses its own professionals. The MPM public Coach Marketplace is hidden from all staff members — the "Hire a Professional" entry point, the Coaches page, and coaching cards on the Pricing page are all removed.
          </p>
          <p className="text-white/60 text-xs leading-relaxed">
            This keeps your team's workflow focused inside your organization's own ProCare ecosystem.
          </p>
        </div>
      ),
    },
    {
      id: "welcome",
      icon: <Rocket className="w-5 h-5 text-orange-400" />,
      title: "Welcome to Your Organization",
      subtitle: "What you've unlocked and why it matters.",
      narration:
        "Welcome to your MyPerfectMeals Organization. You've just set up something powerful — a centralized platform that gives every coach or practitioner on your team full clinical-grade nutrition tools under one subscription. Your team members each get their own personalized access: AI-powered meal creation, dietary tracking, biometric monitoring, and their own ProCare Studio to manage clients. You handle the seats and billing from one place. They handle their practice. Together, you run a stronger, more effective organization.",
      content: (
        <div className="space-y-3">
          <p className="text-white text-sm leading-relaxed">
            You've set up something powerful — a centralized platform giving every coach or practitioner on your team full clinical-grade nutrition tools under one subscription.
          </p>
          <div className="space-y-2">
            {[
              "Each member gets their own full account with AI meal creation and dietary tracking",
              "Every coach gets a ProCare Studio to manage their own clients independently",
              "You control seats and billing from one central dashboard",
              "Members complete Platform Mastery training so quality stays consistent across your team",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "setup",
      icon: <Rocket className="w-5 h-5 text-orange-400" />,
      title: "First-Time Setup",
      subtitle: "Three steps to get your team running.",
      narration:
        "Getting your organization running takes three steps. Step one: your account is already activated from your purchase. Step two: name your organization from the dashboard. Step three: invite your first team members by entering their email addresses. They'll receive an invitation link, click to accept, and land directly in their account with full access.",
      content: (
        <div className="space-y-4">
          {[
            { step: "1", title: "Your account is active", body: "As soon as you purchased, your organization was created. You already have full access and one seat (yours)." },
            { step: "2", title: "Name your organization", body: "From the Organization Dashboard, tap the pencil icon next to your organization name. This is what your team sees when they accept their invite." },
            { step: "3", title: "Invite your team members", body: `Tap "Invite a Team Member" and enter their email. They receive a link, accept, and land in their account with full access — no separate purchase needed.` },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-orange-600/80 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{step}</div>
              <div>
                <p className="text-white text-sm font-semibold">{title}</p>
                <p className="text-white/90 text-sm mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "org_policies",
      icon: <Shield className="w-5 h-5 text-orange-400" />,
      title: "Organization Policies",
      subtitle: "The rules that govern how your team uses the platform.",
      narration:
        "Your organization policy defines the professional boundaries for every coach on your team. The Independent Client Policy answers one question: can your coaches take personal clients outside of this organization? You have three options — strict, balanced, or open. Whatever you choose is shown to every coach before they accept their invitation, so there are no surprises. Policies can be updated at any time from your dashboard, and every change is logged.",
      content: (
        <div className="space-y-3">
          <p className="text-white text-sm leading-relaxed">
            Policies govern how your team operates within and alongside your organization. All policies are disclosed to coaches before they join.
          </p>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mt-2">Independent Client Policy</p>
          <div className="space-y-2">
            {[
              { label: "Organization Clients Only", body: "All client work must go through the organization. Members may not maintain personal clients independently.", badge: "Strictest", badgeColor: "text-amber-400" },
              { label: "Personal Clients Allowed — With Disclosure", body: "Members may have personal clients but are required to disclose those relationships to you.", badge: "Recommended", badgeColor: "text-blue-400" },
              { label: "Personal Clients Allowed", body: "Members may freely maintain personal clients with no additional requirements.", badge: "Most flexible", badgeColor: "text-green-400" },
            ].map((opt) => (
              <div key={opt.label} className="bg-black/30 border border-white/15 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white text-sm font-semibold">{opt.label}</p>
                  <span className={`text-xs font-semibold ${opt.badgeColor}`}>{opt.badge}</span>
                </div>
                <p className="text-white/70 text-xs leading-relaxed">{opt.body}</p>
              </div>
            ))}
          </div>
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">How to change your policy</p>
            <p className="text-white/90 text-xs leading-relaxed">
              Open the Organization Dashboard and scroll to the <span className="text-orange-400 font-semibold">Client Ownership Policy</span> card. Changes take effect immediately and are logged in your policy history.
            </p>
          </div>
          <div className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white/70 text-xs">Coming soon: Messaging Policy, Care Team Policy, Branding Policy, HIPAA Settings, Academy Requirements, and Certification Requirements.</p>
          </div>
        </div>
      ),
    },
    {
      id: "client_ownership",
      icon: <Building2 className="w-5 h-5 text-orange-400" />,
      title: "Client Ownership",
      subtitle: "Who owns which clients — and why it matters.",
      narration:
        "Client ownership is one of the most important concepts in the platform. Organization clients are clients enrolled through your organization's sponsored workspace — they belong to the organization. Personal clients are clients a coach brings independently or enrolls outside of your organization — they belong to the coach. This separation is intentional and permanent. It protects your investment as an organization and it protects the coach's independently built business. When a coach leaves, organization clients stay. Personal clients go with the coach. No data is lost either way.",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-3">
              <p className="text-blue-300 text-xs font-semibold mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Organization Clients</p>
              <p className="text-white/80 text-xs leading-relaxed">Enrolled through the org. Belong to the organization. Stay when a coach leaves.</p>
            </div>
            <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-3">
              <p className="text-green-300 text-xs font-semibold mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" /> Personal Clients</p>
              <p className="text-white/80 text-xs leading-relaxed">Coach's own practice. Belong to the coach. Leave with the coach.</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              "Privacy: org clients' identities are visible to the owner; personal clients are private to the coach",
              "Separation: org and personal client data never mix",
              "Continuity: clients receive uninterrupted care regardless of coaching changes",
              "Transparency: coaches know exactly what they own before they join",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">Coming soon</p>
            <p className="text-white/90 text-xs leading-relaxed">
              Ownership stamping, client reassignment, and analytics dashboards showing org vs. personal client counts per coach are in active development.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "seats",
      icon: <Settings className="w-5 h-5 text-orange-400" />,
      title: "Seat Management",
      subtitle: "Add, remove, invite, and track your team capacity.",
      narration:
        "Your seat count determines how many people can be part of your organization at once. Each active member and each pending invitation uses one seat. You can add or remove seats anytime from the Organization Dashboard. Adding seats increases your monthly cost by the per-seat price. Changes are prorated on your Stripe invoice, so you only pay for what you use in a given billing period. When you remove a member, they lose organization access immediately but their personal account and data remain intact.",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 border border-white/15 rounded-xl p-3">
              <p className="text-orange-400 text-xs font-semibold mb-1">Uses a seat</p>
              <p className="text-white/90 text-xs">Active members, pending invites</p>
            </div>
            <div className="bg-black/30 border border-white/15 rounded-xl p-3">
              <p className="text-green-400 text-xs font-semibold mb-1">Frees a seat</p>
              <p className="text-white/90 text-xs">Removing members, expired invites</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              "Inviting a coach — send invite, pending invite claims a seat immediately",
              "Invite expires after 72 hours — seat opens back up automatically",
              "Removing a coach — access ends immediately, seat freed",
              "Adding seats — prorated immediately on your current invoice",
              "Removing seats — takes effect at next billing cycle",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
          <div className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white/90 text-xs">To manage seats: tap the <span className="text-orange-400 font-semibold">Manage</span> link next to your seat counter on the Organization Dashboard.</p>
          </div>
        </div>
      ),
    },
    {
      id: "invites",
      icon: <UserPlus className="w-5 h-5 text-orange-400" />,
      title: "Inviting Your Team",
      subtitle: "How invitations work from send to acceptance.",
      narration:
        "When you send an invitation, the person receives an email with a secure link. That link is valid for 72 hours. When they click it, they're walked through account creation or login if they already have an account. Once they accept, they're added to your organization and their seat is marked active. Pending invitations count against your available seat count the moment you send them.",
      content: (
        <div className="space-y-3">
          <p className="text-white text-sm leading-relaxed">
            When you send an invitation, the person receives a secure email link valid for 72 hours.
          </p>
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">Seats and invites</p>
            <p className="text-white/90 text-xs leading-relaxed">
              Pending invitations count against your seat capacity immediately. Expired invites (after 72 hours) release their seat automatically.
            </p>
          </div>
          <div className="space-y-2">
            {[
              "New users are walked through account creation during acceptance",
              "Existing users land directly in their account with organization access granted",
              "Coaches see your current Client Ownership Policy before accepting — transparency by design",
              "You can resend or cancel any pending invite from the dashboard",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "coach_independence",
      icon: <Briefcase className="w-5 h-5 text-orange-400" />,
      title: "Coach Independence",
      subtitle: "What coaches can do alongside their work here.",
      narration:
        "Whether your organization allows personal clients or not, every coach on your team has opportunities beyond their role here. Coaches can become My Perfect Meals Affiliates — earning their own promo code, commissions, and referral income. They can build their own coaching business independently, even while working with your organization. If they ever leave, they can activate their own Professional subscription and continue using the platform for their personal clients without interruption. My Perfect Meals is designed to support professional growth, not restrict it.",
      content: (
        <div className="space-y-3">
          <div className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white text-sm font-semibold mb-2">What coaches can always do</p>
            <div className="space-y-1.5">
              {[
                "Become a My Perfect Meals Affiliate and earn commissions",
                "Receive their own promo code and marketing resources",
                "Build their personal client roster (subject to your org policy)",
                "Activate an independent Professional subscription if they leave",
                "Keep their certifications and training history forever",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/80 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">Your policy controls one thing</p>
            <p className="text-white/90 text-xs leading-relaxed">
              Your Client Ownership Policy determines whether coaches may enroll personal clients under their org-sponsored seat — not whether they may exist as independent professionals. Affiliate membership, certifications, and independent accounts are always available.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "offboarding",
      icon: <LogOut className="w-5 h-5 text-orange-400" />,
      title: "Offboarding a Coach",
      subtitle: "What happens when a team member leaves.",
      narration:
        "Offboarding is designed to protect everyone involved. When a coach leaves your organization, organization clients stay with you — they were enrolled through your sponsored workspace and belong to the organization. Personal clients leave with the coach — those relationships belong to them. The coach's own account, data, certifications, and training history are completely unaffected. They can activate their own Professional subscription and continue practicing independently. No data is lost. No relationships are severed that shouldn't be.",
      content: (
        <div className="space-y-3">
          <div className="space-y-2">
            {[
              { icon: <Building2 className="w-4 h-4 text-orange-400" />, label: "Organization clients", outcome: "Stay with the organization", color: "border-orange-500/30 bg-orange-950/20" },
              { icon: <Briefcase className="w-4 h-4 text-green-400" />, label: "Personal clients", outcome: "Stay with the coach", color: "border-green-500/30 bg-green-950/20" },
              { icon: <GraduationCap className="w-4 h-4 text-blue-400" />, label: "Certifications & training", outcome: "Stay with the coach — always", color: "border-blue-500/30 bg-blue-950/20" },
              { icon: <Heart className="w-4 h-4 text-purple-400" />, label: "Professional account", outcome: "Can continue independently", color: "border-purple-500/30 bg-purple-950/20" },
            ].map(({ icon, label, outcome, color }) => (
              <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${color}`}>
                <div className="flex-shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">{label}</p>
                </div>
                <p className="text-white/70 text-xs text-right flex-shrink-0">{outcome}</p>
              </div>
            ))}
          </div>
          <div className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white/90 text-xs leading-relaxed">
              Removing a member from the dashboard ends their sponsored access immediately. They receive an in-app notification. Their personal account remains fully intact.
            </p>
          </div>
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">Coming soon</p>
            <p className="text-white/90 text-xs">Client reassignment tools — transfer org clients to another coach on your team before removing a member.</p>
          </div>
        </div>
      ),
    },
    {
      id: "members",
      icon: <Users className="w-5 h-5 text-orange-400" />,
      title: "Managing Members",
      subtitle: "Roles, removing coaches, and what happens to their data.",
      narration:
        "Every team member you invite joins as a standard member with their own independent account. Their clients, meal plans, and ProCare Studio are entirely their own. What you control is their seat. When you remove a member, they immediately lose the organization access you sponsored. Their personal account and all their data remain safe — they just no longer have access to the clinical tools that required the organization subscription.",
      content: (
        <div className="space-y-3">
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-300 text-xs font-semibold mb-1">Organization relationship</p>
            <p className="text-white/90 text-xs leading-relaxed">
              You sponsor access — you don't own your members' accounts. Their clients, sessions, and data belong to them individually.
            </p>
          </div>
          <div className="space-y-2">
            {[
              "Removing a member immediately ends their sponsored access",
              "They're notified inside the app with a clear explanation",
              "Their personal account, meals, and client data are untouched",
              "They can subscribe independently to restore clinical access",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "procare",
      icon: <Heart className="w-5 h-5 text-orange-400" />,
      title: "ProCare Studio & Client Access",
      subtitle: "How coaches manage their own clients through your organization.",
      narration:
        "Every member you add to your organization has access to ProCare Studio — their own professional client management space. They can enroll clients, review biometrics, assign meal plans, and communicate through the platform. This is independent of you. You provide the subscription that unlocks the tools; they manage their client relationships on their own.",
      content: (
        <div className="space-y-3">
          <p className="text-white text-sm leading-relaxed">
            Every member gets their own ProCare Studio — a full professional workspace for managing clients, reviewing health data, and coordinating care.
          </p>
          <div className="space-y-2">
            {[
              "Each coach manages their own client roster independently",
              "Clients belong to the coach (personal) or the org (organization-enrolled)",
              "Coaches can assign meal plans, track biometrics, and communicate with clients",
              "You don't have visibility into individual client sessions — privacy by design",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "academy",
      icon: <GraduationCap className="w-5 h-5 text-orange-400" />,
      title: "Academy & Platform Mastery",
      subtitle: "The training requirement every team member must complete.",
      narration:
        "Every member of your organization is required to complete Platform Mastery training through the MyPerfectMeals Academy. This is the foundational certification that ensures everyone on your team understands how to use the tools correctly and responsibly. Platform Mastery covers meal creation, dietary protocols, clinical tools, and client communication standards. It's not optional.",
      content: (
        <div className="space-y-3">
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">Required for all members</p>
            <p className="text-white/90 text-xs leading-relaxed">
              Platform Mastery is mandatory — not optional. Members access the Academy from the Business Center in their account.
            </p>
          </div>
          <p className="text-white text-sm leading-relaxed">
            The Academy covers meal creation workflows, dietary protocols, ProCare client management, clinical tools, and platform standards.
          </p>
          <div className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white/90 text-xs">Encourage new team members to complete Platform Mastery within their first week. It takes about 2–3 hours to complete all modules.</p>
          </div>
        </div>
      ),
    },
    {
      id: "billing",
      icon: <CreditCard className="w-5 h-5 text-orange-400" />,
      title: "Billing & Subscription",
      subtitle: "How per-seat billing works and how to manage your subscription.",
      narration:
        "Your subscription is billed monthly at $44.99 per seat. You're billed for the number of seats on your plan, not just the ones currently filled. When you add seats, Stripe prorates the change immediately. When you remove seats, the reduction applies at your next billing cycle.",
      content: (
        <div className="space-y-3">
          <div className="bg-black/30 border border-white/15 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/90 text-sm">Price per seat</span>
              <span className="text-white font-semibold text-sm">$44.99 / mo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/90 text-sm">Billing cycle</span>
              <span className="text-white font-semibold text-sm">Monthly</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/90 text-sm">Billed for</span>
              <span className="text-white font-semibold text-sm">Seat count (not filled seats)</span>
            </div>
          </div>
          <div className="space-y-2">
            {[
              "Adding seats: prorated immediately on current invoice",
              "Removing seats: takes effect at next billing cycle",
              "Cancel, update payment, or download invoices via Stripe portal",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "policy_history",
      icon: <History className="w-5 h-5 text-orange-400" />,
      title: "Policy History",
      subtitle: "A log of every policy change, who made it, and when.",
      narration:
        "Every time you update your Client Ownership Policy, the change is recorded with a timestamp and the account that made it. This creates a clear, auditable record that protects both your organization and your team members. If a coach ever questions what the policy was when they joined, you have the full history.",
      content: (
        <div className="space-y-3">
          {historyLoading && (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white/50 text-xs mt-2">Loading history…</p>
            </div>
          )}
          {!historyLoading && policyHistory.length === 0 && (
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 text-white/30 mx-auto mb-2" />
              <p className="text-white/50 text-sm">No policy changes recorded yet.</p>
              <p className="text-white/30 text-xs mt-1">Changes you make to your Client Ownership Policy will appear here.</p>
            </div>
          )}
          {!historyLoading && policyHistory.length > 0 && (
            <div className="space-y-2">
              {policyHistory.map((item) => {
                const date = new Date(item.changed_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                const time = new Date(item.changed_at).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit",
                });
                return (
                  <div key={item.id} className="bg-black/30 border border-white/15 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-white/50 text-xs">{date} at {time}</p>
                      <p className="text-white/40 text-xs text-right">{item.changed_by_name || item.changed_by_email || "Administrator"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.old_policy && (
                        <>
                          <span className="text-white/50 text-xs bg-white/10 rounded px-2 py-0.5">{POLICY_NAMES[item.old_policy] ?? item.old_policy}</span>
                          <ArrowRight className="w-3 h-3 text-white/30 flex-shrink-0" />
                        </>
                      )}
                      <span className="text-orange-300 text-xs bg-orange-600/20 rounded px-2 py-0.5">{POLICY_NAMES[item.new_policy] ?? item.new_policy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-black/30 border border-white/10 rounded-xl p-3">
            <p className="text-white/50 text-xs">Policy changes are logged automatically. Coming soon: add a reason note when you change the policy.</p>
          </div>
        </div>
      ),
    },
    {
      id: "philosophy",
      icon: <Star className="w-5 h-5 text-orange-400" />,
      title: "Enterprise Design Philosophy",
      subtitle: "Why My Perfect Meals is built the way it is.",
      narration:
        "My Perfect Meals was designed around one simple principle: everyone should know exactly what they own. Organizations should feel secure investing in their teams. Professionals should feel secure building their careers. Clients should receive uninterrupted care. And policies should be transparent before anyone joins. That's not just a design goal — it's the foundation for every enterprise feature we've built.",
      content: (
        <div className="space-y-3">
          <div className="bg-orange-600/10 border border-orange-500/20 rounded-xl p-4">
            <p className="text-orange-300 text-sm font-semibold mb-3 text-center">Our guiding principle</p>
            <p className="text-white text-sm leading-relaxed italic text-center">
              "My Perfect Meals is designed to protect everyone involved."
            </p>
          </div>
          <div className="space-y-2">
            {[
              { who: "Organizations", what: "own the relationships they create." },
              { who: "Professionals", what: "own the businesses they build." },
              { who: "Clients", what: "maintain continuity of care." },
              { who: "Policies", what: "are transparent to everyone before they begin." },
            ].map(({ who, what }) => (
              <div key={who} className="flex items-start gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <p className="text-white text-sm"><span className="font-semibold">{who}</span> {what}</p>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs leading-relaxed">
            Whenever we add a new enterprise capability — client reassignment, analytics, multi-location support — this principle is the filter it passes through. If it doesn't protect everyone involved, it doesn't ship.
          </p>
        </div>
      ),
    },
    {
      id: "coming_soon",
      icon: <Zap className="w-5 h-5 text-orange-400" />,
      title: "Coming Soon",
      subtitle: "Enterprise capabilities actively in development.",
      narration:
        "My Perfect Meals is actively expanding its enterprise capabilities. What you have today is the foundation. The features coming next are designed for organizations that want to scale — manage multiple locations, delegate regional management, access enterprise analytics, and eventually operate under their own brand.",
      content: (
        <div className="space-y-3">
          <p className="text-white/70 text-xs leading-relaxed">These enterprise features are actively in development. They're designed to grow with your organization as it scales.</p>
          <div className="space-y-2">
            {[
              { title: "Client Ownership Stamping", desc: "Automatically classify each client as org-owned or personally-owned at enrollment." },
              { title: "Client Reassignment", desc: "Transfer organization clients to another coach before offboarding a team member." },
              { title: "Enterprise Analytics", desc: "Seat utilization, client growth, and training completion dashboards for org owners." },
              { title: "Multi-Location Support", desc: "Manage multiple locations or departments under one enterprise account." },
              { title: "Regional Managers", desc: "Delegate seat management and oversight to regional leads." },
              { title: "Franchise & White-Label", desc: "Run My Perfect Meals under your own brand with custom onboarding." },
              { title: "Enterprise Reporting", desc: "Compliance reports, certification audits, and policy change documentation for enterprise clients." },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-black/30 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  <p className="text-white text-sm font-semibold">{title}</p>
                </div>
                <p className="text-white/50 text-xs leading-relaxed pl-3.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "faq",
      icon: <HelpCircle className="w-5 h-5 text-orange-400" />,
      title: "Frequently Asked Questions",
      subtitle: "Common questions from organization owners and coaches.",
      narration:
        "Here are the most common questions we hear from organization owners and their coaches. Who owns my clients? What happens if someone quits? Can coaches have their own business? Can they become affiliates? These questions come up constantly, and the answers are built into the platform design.",
      content: (
        <div className="space-y-3">
          {[
            { q: "Can my coaches have their own coaching business?", a: "Yes. Coaches can always become affiliates, earn commissions, and build their own independent practice. Your Client Ownership Policy controls whether they can enroll personal clients under your sponsored seat — not whether they can exist as independent professionals." },
            { q: "Can coaches become affiliates?", a: "Absolutely — and we encourage it. Any coach on your team can apply for affiliate status, receive their own promo code, and earn commissions independently. Their affiliate account is separate from their org membership." },
            { q: "Who owns the clients my coaches work with?", a: "It depends on how they were enrolled. Clients enrolled through your organization belong to the organization. Clients a coach brought independently belong to the coach. This separation is enforced by the platform." },
            { q: "What happens if a coach quits or is removed?", a: "Organization clients stay with you. Personal clients go with the coach. The coach's account, certifications, and data are completely unaffected. They can activate their own Professional subscription and continue practicing." },
            { q: "Can I change my policy later?", a: "Yes. Policy changes take effect immediately and are logged with a timestamp. Coaches who joined under a different policy will see the updated policy, and the change is visible in your Policy History." },
            { q: "Can I add more seats?", a: "Yes — from the Organization Dashboard, tap Manage next to your seat counter. Changes are prorated by Stripe." },
            { q: "Can I remove seats?", a: "Yes. Reducing your seat count takes effect at your next billing cycle. Note: you must remove a member before removing their seat." },
            { q: "What happens to certifications if a coach leaves?", a: "Certifications stay with the coach forever. They are tied to the individual's account, not the organization." },
            { q: "Can a member use their own subscription instead of my seat?", a: "No — once they accept your invite, your organization sponsorship covers their access." },
            { q: "What if a coach already has their own subscription?", a: "Your sponsorship takes over and their personal subscription is paused. They won't be double charged." },
            { q: "What happens if I miss a payment?", a: "A brief grace period applies. If unresolved, member access is suspended until billing is current." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-black/30 border border-white/15 rounded-xl p-3">
              <p className="text-white text-sm font-semibold mb-1">{q}</p>
              <p className="text-white/80 text-sm">{a}</p>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-950/30 to-black/80 pb-28" style={{ paddingBottom: "max(7rem, calc(env(safe-area-inset-bottom) + 6rem))" }}>
      {/* Header */}
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
        <div className="fixed top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Organization Success Center</h1>
              <p className="text-white/60 text-xs">Your complete guide to running your organization</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="px-4 pb-4" style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}>
        <div className="bg-gradient-to-br from-orange-600/20 via-orange-600/10 to-transparent border border-orange-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-600/30 border border-orange-500/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Your complete guide</h2>
              <p className="text-white/60 text-xs">Everything about running your organization</p>
            </div>
          </div>
          <p className="text-white text-sm leading-relaxed">
            This center explains how your organization works, what policies mean, how client ownership is protected, and what's coming next — so every owner and every coach has the same understanding from day one.
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="px-4 space-y-2">
        {modules.map((mod) => {
          const isOpen = expandedId === mod.id;
          return (
            <div key={mod.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => toggle(mod.id)}
              >
                <div className="flex-shrink-0">{mod.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm leading-tight">{mod.title}</p>
                  <p className="text-white/50 text-xs mt-0.5 leading-tight">{mod.subtitle}</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
                  {mod.narration && (
                    <NarrationBar sections={[{ heading: mod.title, text: mod.narration }]} />
                  )}
                  {mod.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
