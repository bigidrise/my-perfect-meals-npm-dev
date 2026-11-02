import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { getCornerCapabilities } from "./capabilityRegistry";
import { FEATURE_USAGE_KNOWLEDGE } from "./featureUsageKnowledge";
import type { ChefKnowledgeAccess } from "./platformKnowledgeAccess";

export interface PlatformFeatureFact {
  independentBackendEntry?: string;
  id: string;
  name: string;
  aliases: string[];
  purpose: string;
  goals: string[];
  doesNotDo: string[];
  gettingStarted: string[];
  outputs: string;
  route: string | null;
  access: string;
  verification: "verified" | "partial" | "unavailable";
  audience: "member" | "organization_admin" | "professional";
  /** Audit evidence only. Never sent to the conversation model. */
  evidence: string[];
}

const evidence = ["client/src/components/Router.tsx"];
const additionalFacts: PlatformFeatureFact[] = [
  {
    id: "academy", name: "My Perfect Meals Academy", aliases: ["Academy", "certification"],
    purpose: "Learn the platform and follow the existing certification progression.",
    goals: ["Learn how MPM works", "Review certification progress"],
    doesNotDo: ["Education or a certificate does not grant clinical credentials, ProCare access or permission to treat clients."],
    gettingStarted: ["Open More, then My Perfect Meals Academy.", "Use Start Certification Path or Continue Certification as shown for your progress. Platform Mastery is part of the path; ProCare Certification is a separate later track."],
    outputs: "Lessons, completion/progression status and earned educational credentials.",
    route: "/academy", access: "Authenticated learner; each track retains its own progression and access checks.",
    verification: "verified", audience: "member",
    evidence: [...evidence, "client/src/pages/More.tsx", "client/src/pages/academy/AcademyHome.tsx", "server/routes/academyRoutes.ts"],
  },
  {
    id: "clinical_support", name: "Clinical and Nutrition Protocol Hubs",
    aliases: ["Diabetes", "GLP-1", "Anti-Inflammatory", "cardiac", "kidney", "oncology"],
    purpose: "Existing authorized support and builder workflows, not diagnoses or treatments supplied by Chef.",
    goals: ["Understand the distinction between personal support and clinician-owned guidance"],
    doesNotDo: ["Chef cannot activate a protocol, prescribe a target, read restricted labs or switch a clinical builder.", "Do not invent common steps for different clinical hubs or promise new activation of saved legacy supports."],
    gettingStarted: ["Use your existing authorized hub or assigned builder. Ask which support or page the member is using when verified page-specific instructions are unavailable."],
    outputs: "Feature-specific nutrition support; clinical decisions and evidence remain owned by the existing workflow.",
    route: null, access: "Clinical, protocol, onboarding, professional relationship and consent checks vary by workflow.",
    verification: "partial", audience: "member", evidence: [...evidence, "server/services/coaching/capabilityRegistry.ts"],
  },
  {
    id: "account_profile", name: "Profile and Account", aliases: ["nutrition preferences", "account settings"],
    purpose: "Review the member's own nutrition goals, preferences and restrictions.",
    goals: ["Review preferences", "Understand account settings"],
    doesNotDo: ["Chat does not save profile changes, change credentials, cancel subscriptions or replace saved macro targets."],
    gettingStarted: ["Open Profile for nutrition profile edits; use the existing account and subscription controls for account actions.", "Macro Calculator owns calculations and confirmed target saves."],
    outputs: "Changes saved by the member in the existing settings workflow.",
    route: "/profile", access: "Exact account ownership; clinical-owned settings and safety protections remain intact.",
    verification: "verified", audience: "member", evidence: [...evidence, "server/services/coaching/platformKnowledge.ts"],
  },
  {
    id: "education", name: "App Library and Tutorial Hub", aliases: ["Learn", "tutorials", "Sources & Medical Information"],
    purpose: "Existing platform education, feature tutorials and source/methodology information.",
    goals: ["Learn a workflow", "Find educational resources"],
    doesNotDo: ["A source list does not clinically validate a particular claim.", "Some tutorials are Coming Soon; do not promise a video for every feature."],
    gettingStarted: ["App Library is the Learn page; Tutorial Hub is the tutorials page.", "Sources & Medical Information on the dashboard opens a dialog, not a separate Sources route."],
    outputs: "Educational content, available tutorials and source explanations.",
    route: "/learn", access: "Member education; destination-specific guards remain in effect.",
    verification: "verified", audience: "member", evidence: [...evidence, "server/services/coaching/platformHelpKnowledge.ts"],
  },
  {
    id: "organization_invitations", name: "Business Suite Client Invitations",
    aliases: ["invite clients", "invite patients", "organization invitations"],
    purpose: "Authorized organization administrators invite clients through the existing selected business workspace.",
    goals: ["Invite a client", "Understand an invitation's status"],
    doesNotDo: ["Chef cannot send invitations, grant paid access or select an organization/Location.", "Professional invitations and client invitations are different; do not promise identical access clocks or permanent sponsored access.", "No cross-organization or parent-to-Location access is implied."],
    gettingStarted: ["Enter the intended Business Suite workspace and verify the organization/Location.", "Use the existing Invite Client action and enter the client's email in its invitation dialog.", "The authorized administrator submits the invitation there; the recipient follows the emailed acceptance flow."],
    outputs: "An invitation and its existing delivery/acceptance status, not guaranteed successful delivery or account activation.",
    route: null, access: "Verified active owner/admin membership; business access, invitation permissions, capacity and exact workspace checks still apply.",
    verification: "verified", audience: "organization_admin",
    evidence: [...evidence, "client/src/pages/BusinessDashboard.tsx", "server/routes/businessRoutes.ts", "server/services/organizationWorkspaceService.ts"],
  },
  {
    id: "professional_studios", name: "Professional ProCare Studios",
    aliases: ["Physician Studio", "Trainer Studio", "professional clients"],
    purpose: "Role-appropriate professional client work, distinct from the member's personal nutrition account.",
    goals: ["Understand the personal/professional distinction", "Find existing professional client tools"],
    doesNotDo: ["Chef does not verify credentials, create a care relationship, open a client folder or grant access to clinical evidence.", "Organization ownership does not make someone a practitioner.", "Never apply a professional's own targets to a client."],
    gettingStarted: ["Use the existing role-appropriate Studio after professional activation and training.", "Client selection, consent and clinical authorization must be checked by that workspace; do not invent client-specific routes."],
    outputs: "Authorized client-management and communication workflows, depending on verified role.",
    route: null, access: "Professional identity/readiness, credential, training, legal, MFA and current entitlement requirements; each client relationship remains separately authorized.",
    verification: "partial", audience: "professional",
    evidence: [...evidence, "server/services/professionalIdentityReadiness.ts", "server/services/coaching/platformKnowledge.ts"],
  },
];

/** Reuse reviewed destination descriptions and controls; no second route registry. */
export function buildPlatformFeatureCatalog(options?: { featureIntelligence?: boolean }): PlatformFeatureFact[] {
  const destinations = getCornerCapabilities(["all"]).filter(cap => cap.id in COACH_DESTINATIONS);
  return [
    ...(options?.featureIntelligence ? [{
      id: "ask_chef", name: "Ask Chef", aliases: ["Chef", "Chef's help"],
      purpose: "Ask Chef is My Perfect Meals' conversational assistant for food and nutrition questions and understanding the platform's tools. It can explain supported workflows and recommend approved features. Opening a feature is a separate, authorized handoff; generating food, saving changes and other actions happen in that feature, not automatically in chat.",
      goals: ["Understand My Perfect Meals tools", "Discuss food and nutrition questions"],
      doesNotDo: ["Does not diagnose, prescribe, grant access, change clinical protocols or execute feature actions from an explanation."],
      gettingStarted: ["Ask a question in Ask Chef. Review its answer; use a separately authorized navigation action when offered."],
      outputs: "Conversation and supported, consent-controlled feature handoffs, not automatic feature execution.",
      route: "/coach-corner/home", access: "Authenticated access on Free, Essential, Pro and Clinical; existing server safety/navigation checks remain.",
      independentBackendEntry: "/api/coach/message",
      verification: "verified" as const, audience: "member" as const,
      evidence: ["client/src/pages/CoachsCorner.tsx", "server/routes/coachingEngine.ts",
        "server/services/coaching/conciergeConversation.ts", "server/services/coaching/conciergeInstructions.ts"],
    }] : []),
    ...destinations.map(cap => {
      const id = cap.id as CoachDestinationId;
      const usage = FEATURE_USAGE_KNOWLEDGE[id];
      const destination = COACH_DESTINATIONS[id];
      return {
        id, name: cap.label, aliases: [...new Set([cap.label,
          ...("navigationLabel" in destination ? [destination.navigationLabel] : [])])],
        purpose: cap.description.split(" Required inputs and handoff:")[0],
        goals: [cap.description.split(" Required inputs and handoff:")[0]],
        doesNotDo: usage?.notes ?? ["No Chef prefill or automatic execution is authorized."],
        gettingStarted: usage ? [usage.descriptionInput, ...usage.controls] : ["Use the verified destination's own inputs; unreviewed control labels must not be guessed."],
        outputs: usage?.generationAction ?? "The destination owns its results; Chef does not execute the workflow.",
        route: destination.route, access: `${destination.access}; click-time and destination guards are authoritative.`,
        verification: usage ? "verified" as const : "partial" as const,
        audience: "member" as const,
        evidence: [...evidence, "server/services/coaching/capabilityRegistry.ts", "server/services/coaching/featureUsageKnowledge.ts", "shared/coaching/navigation.ts"],
      };
    }),
    ...additionalFacts,
  ];
}

export function getMemberPlatformCatalog(access?: ChefKnowledgeAccess) {
  return buildPlatformFeatureCatalog()
    // Approved destinations already have descriptions in availableFeatures and
    // controls in featureUsage. Do not send those same records a third time.
    .filter(fact => !(fact.id in COACH_DESTINATIONS))
    .filter(fact => fact.audience === "member" ||
      (fact.audience === "organization_admin" && access?.organizationAdmin === true) ||
      (fact.audience === "professional" && access?.professional === true))
    .map(({ evidence: _evidence, ...fact }) => fact);
}
