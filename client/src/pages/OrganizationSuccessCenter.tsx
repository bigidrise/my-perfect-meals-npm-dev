import { useState } from "react";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { NarrationBar } from "@/components/NarrationBar";

interface Module {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  narration: string;
  content: React.ReactNode;
}

const modules: Module[] = [
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
      "Getting your organization running takes three steps. Step one: your account is already activated from your purchase. Step two: name your organization from the dashboard. This is the name your team members will see when they accept their invite. Step three: invite your first team members by entering their email addresses. They'll receive an invitation link, click to accept, and land directly in their account with full access. That's it. Each person you invite uses one seat. You can add or remove seats at any time from the Organization Dashboard.",
    content: (
      <div className="space-y-4">
        {[
          {
            step: "1",
            title: "Your account is active",
            body: "As soon as you purchased, your organization was created. You already have full access and one seat (yours).",
          },
          {
            step: "2",
            title: "Name your organization",
            body: "From the Organization Dashboard, tap the pencil icon next to your organization name. This is what your team sees when they accept their invite.",
          },
          {
            step: "3",
            title: "Invite your team members",
            body: `Tap "Invite a Team Member" and enter their email. They receive a link, accept, and land in their account with full access — no separate purchase needed.`,
          },
        ].map(({ step, title, body }) => (
          <div key={step} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-orange-600/80 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {step}
            </div>
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
    id: "invites",
    icon: <UserPlus className="w-5 h-5 text-orange-400" />,
    title: "Inviting Your Team",
    subtitle: "How invitations work from send to acceptance.",
    narration:
      "When you send an invitation, the person receives an email with a secure link. That link is valid for 72 hours. When they click it, they're walked through account creation or login if they already have an account. Once they accept, they're added to your organization and their seat is marked active. Pending invitations count against your available seat count the moment you send them — so if you have ten seats and send ten invites, you're at capacity even before anyone accepts. If someone doesn't accept within 72 hours, the invite expires and the seat opens back up. You can always resend from the dashboard.",
    content: (
      <div className="space-y-3">
        <p className="text-white text-sm leading-relaxed">
          When you send an invitation, the person receives a secure email link valid for 72 hours.
        </p>
        <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3">
          <p className="text-orange-300 text-xs font-semibold mb-1">Important to know</p>
          <p className="text-white/90 text-xs leading-relaxed">
            Pending invitations count against your seat capacity immediately when sent. If you have 5 seats and 3 are active members + 2 pending invites, you're at capacity. Expired invites (after 72 hours) release their seat automatically.
          </p>
        </div>
        <div className="space-y-2">
          {[
            "New users are walked through account creation during acceptance",
            "Existing users land directly in their account with organization access granted",
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
    id: "seats",
    icon: <Settings className="w-5 h-5 text-orange-400" />,
    title: "Managing Seats",
    subtitle: "Add, remove, and track your team capacity.",
    narration:
      "Your seat count determines how many people can be part of your organization at once. Each active member and each pending invitation uses one seat. You can add or remove seats anytime from the Organization Dashboard by tapping the Manage button next to your seat counter. Adding seats increases your monthly cost by the per-seat price. Removing seats decreases it. Changes are prorated on your Stripe invoice, so you only pay for what you use in a given billing period. When you remove a seat by removing a member, they lose organization access immediately but their personal account and data remain intact.",
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
        <p className="text-white text-sm leading-relaxed">
          Seat changes are prorated by Stripe — you only pay for what you use in each billing period.
        </p>
        <div className="bg-black/30 border border-white/15 rounded-xl p-3">
          <p className="text-white/90 text-xs">To manage seats: tap the <span className="text-orange-400 font-semibold">Manage</span> link next to your seat counter on the Organization Dashboard.</p>
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
      "Every team member you invite joins as a standard member with their own independent account. Their clients, meal plans, and ProCare Studio are entirely their own — you don't have visibility into their client sessions or personal meal data. What you control is their seat. When you remove a member, they immediately lose the organization access you sponsored. They receive a notification explaining what changed. Their personal account and all their data remain safe — they just no longer have access to the clinical tools that required the organization subscription. If they want to continue using those features independently, they'd need to subscribe on their own.",
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
      "Every member you add to your organization has access to ProCare Studio — their own professional client management space. They can enroll clients, review biometrics, assign meal plans, and communicate through the platform. This is independent of you. You provide the subscription that unlocks the tools; they manage their client relationships on their own. Clients belong to their coach, not to your organization. This is intentional — it protects your coaches' professional relationships and keeps data structured correctly. Your role as organization owner is to ensure seats are filled by the right people and that everyone meets the training standard.",
    content: (
      <div className="space-y-3">
        <p className="text-white text-sm leading-relaxed">
          Every member gets their own ProCare Studio — a full professional workspace for managing clients, reviewing health data, and coordinating care.
        </p>
        <div className="space-y-2">
          {[
            "Each coach manages their own client roster independently",
            "Clients belong to the coach, not the organization",
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
      "Every member of your organization is required to complete Platform Mastery training through the MyPerfectMeals Academy. This is the foundational certification that ensures everyone on your team understands how to use the tools correctly and responsibly. The Academy is built into the platform — members access it directly from the Business Center. Platform Mastery covers meal creation, dietary protocols, clinical tools, and client communication standards. It's not optional. This requirement protects your clients, maintains quality across your organization, and ensures your team is prepared to work with the platform's clinical features.",
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
      "Your subscription is billed monthly at $44.99 per seat. Your seat count is whatever you set it to — you're billed for the number of seats on your plan, not just the ones currently filled. So if you have 10 seats configured and only 7 are in use, you're still billed for 10. When you add seats, Stripe prorates the change immediately. When you remove seats, the reduction applies at your next billing cycle. All billing is managed through Stripe. If you need to cancel, update your payment method, or download invoices, you can access the Stripe billing portal from your account settings.",
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
    id: "faq",
    icon: <HelpCircle className="w-5 h-5 text-orange-400" />,
    title: "Frequently Asked Questions",
    subtitle: "Common questions from organization owners.",
    narration:
      "Here are the most common questions we hear from organization owners. Can a member use their own personal subscription instead of my seat? No — once someone accepts an invite to your organization, their access is sponsored by your plan. Can I give someone admin access? Currently all members have equal access to the clinical tools. There's no separate admin role for members. What if a coach already has their own subscription? When they join your organization, their individual subscription is paused and your sponsorship takes over. They won't be double charged. Can I transfer ownership of the organization? Not at this time. Organization ownership is tied to the account that purchased the plan. What happens if I miss a payment? After a failed payment, seats remain active for a brief grace period. If the payment isn't resolved, member access is suspended until billing is current.",
    content: (
      <div className="space-y-3">
        {[
          {
            q: "Can a member use their own subscription instead of my seat?",
            a: "No — once they accept your invite, your organization sponsorship covers their access.",
          },
          {
            q: "What if a coach already has their own subscription?",
            a: "Your sponsorship takes over and their personal subscription is paused. They won't be double charged.",
          },
          {
            q: "Can I give someone admin or owner access?",
            a: "Not currently. All members have equal tool access. Organization management is owner-only.",
          },
          {
            q: "Can I transfer organization ownership?",
            a: "Not at this time. Ownership is tied to the account that purchased the plan.",
          },
          {
            q: "What happens if I miss a payment?",
            a: "A brief grace period applies. If unresolved, member access is suspended until billing is current.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="bg-black/30 border border-white/15 rounded-xl p-3">
            <p className="text-white text-sm font-semibold mb-1">{q}</p>
            <p className="text-white/90 text-sm">{a}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OrganizationSuccessCenter() {
  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<string | null>("welcome");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-blue-950 pb-28" style={{ paddingBottom: "max(7rem, calc(env(safe-area-inset-bottom) + 6rem))" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-blue-950/80 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/business-dashboard")}
            className="text-white/60 active:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Organization Success Center</h1>
            <p className="text-white/80 text-xs">Your how-to guide for everything</p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pt-6 pb-4">
        <div className="bg-gradient-to-br from-orange-600/20 via-orange-600/10 to-transparent border border-orange-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-600/30 border border-orange-500/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Your complete guide</h2>
              <p className="text-white/80 text-xs">Read or listen to each topic below</p>
            </div>
          </div>
          <p className="text-white text-sm leading-relaxed">
            Each topic below walks you through a key part of running your organization — from first setup to billing to team management. Tap a topic to read, or hit Listen to hear it narrated.
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="px-4 space-y-2">
        {modules.map((mod, idx) => {
          const isExpanded = expandedId === mod.id;

          return (
            <div
              key={mod.id}
              className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Module Header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : mod.id)}
              >
                <div className="w-8 h-8 rounded-full bg-orange-600/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                  {mod.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs font-semibold tabular-nums">{String(idx + 1).padStart(2, "0")}</span>
                    <p className="text-white text-sm font-semibold truncate">{mod.title}</p>
                  </div>
                  <p className="text-white/80 text-xs mt-0.5 truncate">{mod.subtitle}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/60 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/60 flex-shrink-0" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <div className="pt-4">
                    {mod.content}
                  </div>

                  {/* Narration Bar */}
                  <div className="mt-4 border-t border-white/5 pt-3">
                    <NarrationBar
                      sections={[{ heading: mod.title, text: mod.narration }]}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 mt-6">
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
          <p className="text-white/40 text-xs">
            Have a question not answered here?{" "}
            <span className="text-orange-400">Contact support</span> from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
