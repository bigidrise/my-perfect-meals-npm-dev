import React, { useState, useEffect } from "react";
import { BC_GRADIENT } from "@/components/BusinessCenterShell";
import { useLocation } from "wouter";

const TOTAL_STAGES = 15;
const LS_KEY = "mpm.wl.progress";

interface SavedProgress {
  currentStage: number;
  acknowledged: boolean[];
}

const STAGES = [
  {
    number: 1,
    title: "Why We Built This",
    subtitle: "The problem we set out to solve.",
    content: [
      {
        heading: "Existing software organizes people. It doesn't manage nutrition.",
        body: "Coaches, dietitians, and healthcare professionals spend enormous amounts of time trying to personalize nutrition — writing meal plans, adjusting for medical changes, handling food preferences, responding to cravings, updating shopping lists. None of that is automated. It's all manual.",
      },
      {
        heading: "Clients change. Nutrition rarely keeps up.",
        body: "A coach creates a meal plan. The client gets bored. The client wants Mexican food instead of Mediterranean food. The client goes on vacation. The client starts a GLP-1 medication. The coach is suddenly rebuilding nutrition from scratch — and this happens with every client, continuously. My Perfect Meals was built to help professionals keep nutrition aligned while allowing food choices to adapt.",
      },
      {
        heading: "My Perfect Meals was built to solve that problem.",
        body: "We built adaptive, clinically-safe AI that personalizes nutrition for each individual — and keeps personalizing as that individual changes. Professionals stay in control of the guardrails, the relationship, and the outcomes. The platform handles the continuous nutrition work.",
      },
      {
        heading: "The white label program makes that possible under your brand.",
        body: "If you serve clients, patients, or members who need better nutrition — and you want a professional-grade platform that represents your practice — this program was built for you.",
      },
    ],
    ack: "I understand the problem this platform was built to solve and why it exists.",
  },
  {
    number: 2,
    title: "What This Program Creates",
    subtitle: "Before anything else — here's the outcome.",
    content: [
      {
        heading: "You launch an AI-powered nutrition app under your own brand.",
        body: "Your logo. Your name. Your colors. Your members never see ours. They see a polished, professional nutrition product that belongs entirely to your business.",
      },
      {
        heading: "Your members get a clinical-grade nutrition engine.",
        body: "The same AI that powers My Perfect Meals — personalized meal generation, dietary tracking, macro management, and medical-safe guardrails — runs invisibly inside your branded product.",
      },
      {
        heading: "You keep the relationship. We keep the infrastructure.",
        body: "You own your community, your pricing, and your brand identity. We maintain the technology, security, compliance, and ongoing AI development.",
      },
    ],
    ack: "I understand what this program produces — a fully branded nutrition app powered by MPM's AI.",
  },
  {
    number: 3,
    title: "Who This Is Built For",
    subtitle: "This isn't for everyone — and that's by design.",
    content: [
      {
        heading: "Health & wellness professionals with an existing client base.",
        body: "Registered dietitians, certified nutritionists, coaches, and practitioners who already serve clients and want to deepen that relationship through a proprietary digital product.",
      },
      {
        heading: "Fitness brands and studios with recurring membership models.",
        body: "Gyms, training studios, and wellness centers that want to add a nutrition layer to their existing membership — without building or hiring a tech team.",
      },
      {
        heading: "Functional medicine and clinical practices.",
        body: "Practitioners who need clinical-mode capabilities — anti-inflammatory protocols, oncology support, GLP-1/diabetes-appropriate meal generation — with their name on the product.",
      },
      {
        heading: "Organizations building a branded nutrition platform.",
        body: "Startups, physician groups, insurance programs, and wellness brands that intend to serve members, clients, patients, or customers through a dedicated nutrition experience — whether or not they have an established audience today.",
      },
    ],
    ack: "I understand this program is designed for organizations that intend to serve members, clients, patients, or customers through a branded nutrition platform.",
  },
  {
    number: 4,
    title: "What Your Members Experience",
    subtitle: "This is what your clients actually get inside your branded app.",
    content: [
      {
        heading: "AI meal generation — personalized to each member.",
        body: "Every member sets their dietary profile, restrictions, and goals. The AI generates meals tailored specifically to them — not generic templates, not copy-paste plans.",
      },
      {
        heading: "8 creation modes included.",
        body: "Create a Dish, Chef's Kitchen, Snack Creator, Beverage Creator, Craving Creator, Fridge Rescue, Meal Planner, and Holiday Feast. All modes are available to your members under your brand.",
      },
      {
        heading: "Dietary tracking and macro management.",
        body: "Members log meals, track macros, monitor hydration, and measure progress against their targets — all inside your branded experience.",
      },
      {
        heading: "Medical safety guardrails — always on.",
        body: "Clinical-mode features (anti-inflammatory, oncology support, diabetes protocols) are configurable per your practice. Medical guardrails cannot be disabled — they're a core part of what makes this safe for real clients.",
      },
    ],
    ack: "I understand what my members will experience inside the branded product.",
  },
  {
    number: 5,
    title: "How Your Brand Shows Up",
    subtitle: "The difference between a reskin and a real branded product.",
    content: [
      {
        heading: "Your logo and name appear everywhere.",
        body: "App icon, loading screen, navigation, email notifications, and PDF exports all carry your brand identity — not ours. Members interact with your product, not ours.",
      },
      {
        heading: "Your color palette and typography.",
        body: "We configure your primary brand colors and type choices into the interface. The visual language belongs to your business.",
      },
      {
        heading: "Your domain, your app store listing (where applicable).",
        body: "Partners on the appropriate tier can deploy under their own domain and pursue their own App Store and Google Play presence with our technical support.",
      },
      {
        heading: "Your coaching voice — optionally.",
        body: "Partners with existing branded nutrition methodology can layer a 'coaching persona' into the AI generation flow — so the meals feel like they came from your practice, not a generic AI.",
      },
    ],
    ack: "I understand what 'branded' means in this context and what is and isn't customizable.",
  },
  {
    number: 6,
    title: "Your Role as a Partner",
    subtitle: "Partnership means shared responsibility — here's yours.",
    content: [
      {
        heading: "What makes this different from other platforms.",
        body: "Traditional platforms help you manage clients. My Perfect Meals helps you manage both the client experience and the nutrition experience. Coaches, dietitians, and healthcare professionals remain in control of the relationship while the platform continuously adapts meals, recipes, shopping, and nutrition recommendations to the individual. The platform doesn't replace the professional. It extends the professional.",
      },
      {
        heading: "You own the member relationship.",
        body: "You recruit, onboard, support, and retain your members. We don't handle your community, your communications, or your customer service.",
      },
      {
        heading: "You handle your own billing and pricing.",
        body: "You set your own prices and collect payment from your members directly. We charge you a platform fee — what you charge your members is entirely your decision.",
      },
      {
        heading: "You represent the product accurately.",
        body: "You agree not to make medical claims beyond what the platform supports, and to represent capabilities honestly to your audience. This protects your members and your professional standing.",
      },
      {
        heading: "You participate in the launch process.",
        body: "There is a structured 12-week onboarding. You will be expected to engage with milestone reviews, content configuration, and member communication planning.",
      },
    ],
    ack: "I understand my operational responsibilities as a partner — this is a real commitment, not a passive license.",
  },
  {
    number: 7,
    title: "How the AI Actually Works",
    subtitle: "What happens when your member generates a meal.",
    content: [
      {
        heading: "Every generation starts with the member's full profile.",
        body: "Dietary restrictions, allergens, cultural preferences, medical flags, macro targets, and behavioral preferences all feed into each generation. Nothing is ignored.",
      },
      {
        heading: "A real example: the same dinner, three ways.",
        body: "A member with Type 2 diabetes who loves Mexican food and requests 'something like tacos' gets a diabetes-appropriate meal — not a generic taco recipe. A member who avoids gluten and loves Japanese cuisine requesting 'something like sushi' gets a safe, personalized response. The AI doesn't just swap ingredients — it re-engineers the dish around the member's full profile.",
      },
      {
        heading: "Medical constraints are enforced, not suggested.",
        body: "Clinical flags — oncology support, anti-inflammatory protocols, GLP-1 guidance — aren't soft recommendations. They override user preferences when necessary. This is non-negotiable and is what makes the product safe for clinical use.",
      },
      {
        heading: "Your coaching persona shapes the output style.",
        body: "If you've configured a branded coaching voice, the meal names, descriptions, and instructions are styled to match your brand voice — while the underlying nutritional integrity stays locked.",
      },
    ],
    ack: "I understand how the AI personalization and medical guardrail system works.",
  },
  {
    number: 8,
    title: "What You Can and Cannot Change",
    subtitle: "Clear lines. No surprises after you launch.",
    content: [
      {
        heading: "You can change: brand identity, voice, feature tiers, pricing.",
        body: "Logo, colors, typography, coaching persona, which features you offer to which membership tiers, and what you charge — all yours.",
      },
      {
        heading: "You can change: which clinical modes you activate.",
        body: "You can enable or disable clinical features (anti-inflammatory, oncology support, etc.) based on your practice scope and professional credentials.",
      },
      {
        heading: "You cannot change: core medical safety rules.",
        body: "Hard ingredient blocks, clinical override logic, and allergen safety guardrails are platform-level. They cannot be modified or removed by any partner. This is what keeps your members safe.",
      },
      {
        heading: "You cannot change: the underlying AI model or data infrastructure.",
        body: "The AI, the database architecture, the API layer, and the security model are ours to maintain and evolve. Partners do not have access to or control over backend infrastructure.",
      },
    ],
    ack: "I understand what is and isn't configurable — and I'm comfortable with those boundaries.",
  },
  {
    number: 9,
    title: "Who Handles What",
    subtitle: "Responsibilities divided clearly between us.",
    content: [
      {
        heading: "We handle: technology, security, uptime, AI development.",
        body: "Server infrastructure, database management, AI model updates, security patches, HIPAA-aligned data handling, and ongoing platform development — all ours.",
      },
      {
        heading: "We handle: your initial setup and brand configuration.",
        body: "We configure your branded environment, integrate your coaching persona, set up your feature tiers, and deliver a working product before your launch date.",
      },
      {
        heading: "You handle: member support and community management.",
        body: "Questions from your members about their accounts, their meals, or their experience are handled by you. We provide documentation and partner support, but we are not your member-facing support team.",
      },
      {
        heading: "You handle: regulatory compliance for your practice.",
        body: "If you are a licensed practitioner, your professional licensing board's requirements are your responsibility. We provide a compliant platform — applying it appropriately within your scope of practice is yours.",
      },
    ],
    ack: "I understand the division of responsibilities between partner and platform.",
  },
  {
    number: 10,
    title: "Partnership Structure",
    subtitle: "How the ongoing relationship is organized.",
    content: [
      {
        heading: "You are licensing the platform, not purchasing the underlying technology.",
        body: "Partners access the platform through a licensing arrangement — not a software resale or revenue-share model. You pay for platform access; what you charge your members is entirely your business.",
      },
      {
        heading: "Platform support and ongoing maintenance.",
        body: "Your platform fee covers continued access to the AI infrastructure, security updates, compliance maintenance, and platform feature development. The platform improves continuously — your members benefit from updates without additional cost.",
      },
      {
        heading: "Infrastructure and updates are included.",
        body: "Server uptime, database management, AI model refinements, and new feature releases are part of the partnership — not add-ons you purchase separately.",
      },
      {
        heading: "Commitment terms.",
        body: "White label partnerships require a 12-month initial term, reflecting the depth of the setup and onboarding investment on both sides. Partner exits after the initial term require 90 days' written notice to protect your members from disruption.",
      },
    ],
    ack: "I understand how the partnership is structured — licensing model, included support, and commitment terms.",
  },
  {
    number: 11,
    title: "Investment & Cost Drivers",
    subtitle: "What shapes your platform fee — before we give you a number.",
    content: [
      {
        heading: "Clinical mode scope.",
        body: "The more clinical features you activate — oncology support, diabetes protocols, anti-inflammatory mode, physician-assigned overrides — the more infrastructure your environment requires.",
      },
      {
        heading: "Coaching persona depth.",
        body: "A basic brand voice config is included at every tier. A fully developed coaching persona — with custom meal naming, description voice, instruction style, and dietary philosophy — is a configuration project that adds to setup cost.",
      },
      {
        heading: "Active member volume.",
        body: "More members mean more AI generation calls, more storage, and more compute. Your platform fee scales with sustained member activity above the base tier.",
      },
      {
        heading: "App Store deployment and custom domain.",
        body: "Partners who want their own iOS/Android app listing and custom domain incur additional setup and annual maintenance costs tied to those deployments.",
      },
      {
        heading: "Setup fee is separate from the monthly platform fee.",
        body: "There is a one-time setup fee covering brand configuration, environment build-out, and launch support. Monthly platform fees begin after your environment is delivered.",
      },
      {
        heading: "Cost looks different depending on your use case.",
        body: null,
        examples: [
          {
            label: "Small coaching company",
            desc: "An individual coach or small practice serving 50–200 members with standard dietary personalization and no clinical-mode requirements. Lower clinical scope, no App Store deployment, basic persona config.",
          },
          {
            label: "Regional wellness organization",
            desc: "A multi-location fitness brand or wellness group with 500–2,000 members, anti-inflammatory or GLP-1 protocols enabled, custom domain, and a moderately developed coaching persona.",
          },
          {
            label: "Enterprise healthcare deployment",
            desc: "A hospital system, insurance program, or large clinical practice with 5,000+ members, full clinical mode, physician-assigned protocol support, App Store presence, and deep persona configuration.",
          },
        ],
      },
    ],
    ack: "I understand the cost drivers — I don't need an exact number yet, but I understand what shapes it.",
  },
  {
    number: 12,
    title: "Timeline: Week by Week",
    subtitle: "From signed agreement to live product — 12 weeks.",
    content: [
      {
        heading: "Weeks 1–2: Discovery & Configuration",
        body: "Brand assets collected, coaching persona brief completed, clinical feature scope confirmed, member tier structure defined, domain and App Store strategy finalized.",
      },
      {
        heading: "Weeks 3–5: Environment Build",
        body: "Your branded environment is configured — colors, logo, coaching voice, feature gates. Clinical modes activated and tested. Your team receives access to a staging environment for review.",
      },
      {
        heading: "Weeks 6–8: Review & Refinement",
        body: "Two rounds of revisions based on your staging review. Member onboarding flow tested end-to-end. Support documentation drafted for your team.",
      },
      {
        heading: "Weeks 9–10: Member Communication Planning",
        body: "Launch announcement, member onboarding sequence, and support FAQ prepared with your team. Pre-launch member list confirmed.",
      },
      {
        heading: "Weeks 11–12: Launch",
        body: "Production environment goes live. First members onboarded. Partner support channel activated. Post-launch check-in scheduled at Day 7 and Day 30.",
      },
    ],
    ack: "I understand the 12-week launch timeline and what's expected of me at each phase.",
  },
  {
    number: 13,
    title: "Brand & Marketing Alignment",
    subtitle: "How My Perfect Meals is positioned — and what that means for your organization.",
    content: [
      {
        heading: "Successful implementation involves more than technology and training.",
        body: "Organizations must also understand how My Perfect Meals is positioned, communicated, and marketed. As part of the implementation process, partners receive marketing guidance and brand alignment support to ensure their programs are launched and represented effectively.",
      },
      {
        heading: "What you may receive as part of onboarding.",
        body: "Marketing guidance, approved messaging frameworks, positioning recommendations, brand alignment support, launch communication guidance, educational content recommendations, and access to marketing resources.",
      },
      {
        heading: "My Perfect Meals is not marketed as a weight-loss product.",
        body: "The platform is not marketed as a medical treatment, cure, or guaranteed outcome system. Organizations are expected to market their programs responsibly and in alignment with platform guidelines — this protects your members and your professional standing.",
      },
      {
        heading: "Brand standards apply when the platform is represented publicly.",
        body: "While you maintain full ownership of your brand and customer relationships, My Perfect Meals reserves the right to require compliance with platform branding, marketing, and communication standards when the platform is being represented publicly.",
      },
      {
        heading: "The shared goal.",
        body: "To protect consumers, maintain brand integrity, and ensure consistent messaging across all organizations using the platform. This benefits every partner in the program — and every member on it.",
      },
    ],
    ack: "I understand the brand alignment and responsible marketing standards that are part of this partnership.",
  },
  {
    number: 14,
    title: "Investment & Pricing Expectations",
    subtitle: "Select the category that best describes your organization.",
    isPathSelector: true,
    paths: [
      {
        id: "independent-coach",
        label: "Independent Coach / Small Practice",
        description: "Solo providers, small teams, and individual practitioners.",
        active: true,
        detail: {
          whoFor: [
            "Nutrition Coaches",
            "Health Coaches",
            "Fitness Coaches",
            "Functional Medicine Practitioners",
            "Small Wellness Clinics",
            "Solo Providers",
            "Small 1099 Teams",
          ],
          included: [
            "White Label Branding",
            "Provider Dashboard",
            "Care Team Access",
            "ProCare Access",
            "Client Management Tools",
            "Business Success Certification",
            "Platform Certification",
            "Marketing Resources",
            "Affiliate Infrastructure",
            "Ongoing Platform Updates",
          ],
          setupLabel: "Starting at $2,500",
          monthlyLabel: "Starting at $297 / month",
          pricingNote: "Additional customization, integrations, compliance requirements, support levels, and deployment complexity may increase investment requirements.",
        },
      },
      {
        id: "growing-organization",
        label: "Growing Organization",
        description: "Multi-coach practices, fitness brands, and wellness organizations.",
        active: false,
      },
      {
        id: "regional-national",
        label: "Regional or National Organization",
        description: "Multi-location organizations with large member populations.",
        active: false,
      },
      {
        id: "enterprise",
        label: "Enterprise Healthcare",
        description: "Health systems, insurers, and employer wellness programs.",
        active: false,
      },
    ],
    ack: "I understand these investment expectations. I am prepared to discuss my specific requirements during a consultation.",
  },
  {
    number: 15,
    title: "White Label Partnership Application",
    subtitle: "Before we connect, confirm you've read and understood this program.",
    isApplication: true,
    checkboxes: [
      "I have an existing audience, client base, or member community — or I represent an organization building one.",
      "I understand this is a licensing arrangement with a 12-month initial term and a monthly platform fee.",
      "I am prepared to own the member relationship — onboarding, support, and community management.",
      "I understand the medical guardrails cannot be modified or removed.",
      "I understand the cost is shaped by clinical scope, persona depth, member volume, and deployment type — and I'm prepared to discuss this on a call.",
      "I understand the 12-week launch timeline and what's expected of me during that period.",
      "I represent a real organization — not an affiliate, influencer, or reseller arrangement.",
      "I am ready to speak with the MPM partnership team about my specific use case.",
      "I understand that submitting this application does not guarantee acceptance into the White Label Partnership Program.",
      "I understand that white label partnerships are collaborative projects and require participation from both parties throughout implementation.",
    ],
    ack: null,
  },
] as const;


function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    const len = STAGES.length;
    const ack = parsed.acknowledged ?? [];
    const normalized =
      ack.length === len
        ? ack
        : ack.length < len
          ? [...ack, ...new Array(len - ack.length).fill(false)]
          : ack.slice(0, len);
    return { ...parsed, acknowledged: normalized };
  } catch {
    return null;
  }
}

function saveProgress(data: SavedProgress) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}


export default function WhiteLabelSolutions() {
  const [, setLocation] = useLocation();

  const saved = loadProgress();
  const [currentStage, setCurrentStage] = useState(saved?.currentStage ?? 0);
  const [acknowledged, setAcknowledged] = useState<boolean[]>(
    saved?.acknowledged ?? new Array(STAGES.length).fill(false)
  );
  const [appChecks, setAppChecks] = useState<boolean[]>(
    new Array(10).fill(false)
  );
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const stage = STAGES[currentStage];
  const isLast = currentStage === STAGES.length - 1;
  const ackDone = acknowledged[currentStage];
  const allBoxesChecked = appChecks.every(Boolean);

  useEffect(() => {
    saveProgress({ currentStage, acknowledged });
  }, [currentStage, acknowledged]);

  function goBack() {
    if (currentStage > 0) {
      setCurrentStage((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goNext() {
    if (!isLast && ackDone) {
      setCurrentStage((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function toggleAck(i: number) {
    setAcknowledged((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  function toggleAppCheck(i: number) {
    setAppChecks((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} text-white flex flex-col`}>
      {/* Progress header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-orange-300 text-xs font-semibold uppercase tracking-wider">
            Stage {stage.number} of {TOTAL_STAGES}
          </span>
          <div className="flex items-center gap-3">
            {currentStage > 0 && (
              <button
                onClick={goBack}
                className="text-white/50 text-xs underline underline-offset-2"
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => setLocation("/business-center")}
              className="text-white/30 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(stage.number / TOTAL_STAGES) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-4 max-w-2xl mx-auto w-full">
        <div className="pt-5 pb-3">
          <h1 className="text-xl font-bold leading-tight mb-1">{stage.title}</h1>
          <p className="text-white/50 text-sm">{stage.subtitle}</p>
        </div>

        {/* Path selector stage (Stage 13) */}
        {(stage as any).isPathSelector && (
          <div className="mt-2">
            {selectedTier === null ? (
              <div className="space-y-3">
                {(stage as any).paths.map((path: any) => (
                  path.active ? (
                    <button
                      key={path.id}
                      onClick={() => setSelectedTier(path.id)}
                      className="w-full text-left bg-white border border-gray-300 shadow-sm rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-gray-900 font-semibold text-sm">{path.label}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{path.description}</div>
                        </div>
                        <div className="flex-shrink-0 ml-3 w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div
                      key={path.id}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-40"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-gray-700 font-semibold text-sm">{path.label}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{path.description}</div>
                        </div>
                        <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2.5 py-1 flex-shrink-0 ml-3">Coming Soon</span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              (() => {
                const activePath = (stage as any).paths.find((p: any) => p.id === selectedTier);
                const detail = activePath?.detail;
                if (!detail) return null;
                return (
                  <div className="space-y-4">
                    <button
                      onClick={() => setSelectedTier(null)}
                      className="text-gray-500 text-xs underline underline-offset-2"
                    >
                      ← Back to categories
                    </button>

                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                      <div className="text-orange-600 font-bold text-sm">{activePath.label}</div>
                    </div>

                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                      <div className="text-orange-600 font-semibold text-xs uppercase tracking-wider mb-3">Who This Is For</div>
                      <div className="flex flex-wrap gap-2">
                        {detail.whoFor.map((role: string, i: number) => (
                          <span key={i} className="text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-full px-3 py-1">{role}</span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                      <div className="text-orange-600 font-semibold text-xs uppercase tracking-wider mb-3">What's Included</div>
                      <div className="space-y-1.5">
                        {detail.included.map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-700 text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                      <div className="text-orange-600 font-semibold text-xs uppercase tracking-wider mb-3">Investment Expectations</div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-gray-400 text-xs mb-1">Setup & Launch</div>
                          <div className="text-gray-900 font-bold text-base">{detail.setupLabel}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs mb-1">Monthly Licensing</div>
                          <div className="text-gray-900 font-bold text-base">{detail.monthlyLabel}</div>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed border-t border-gray-100 pt-3">{detail.pricingNote}</p>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Regular stage blocks */}
        {!(stage as any).isApplication && !(stage as any).isPathSelector && (
          <div className="space-y-4 mt-2">
            {(stage.content as any[]).map((block: any, i: number) => {
              if (block.tiers) {
                return (
                  <div key={i} className="space-y-3">
                    {block.tiers.map((tier: any, j: number) => (
                      <div key={j} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                        <div className="bg-orange-50 border-b border-gray-200 px-4 py-3">
                          <div className="text-orange-600 font-bold text-sm">{tier.label}</div>
                          <p className="text-gray-500 text-xs mt-0.5 leading-snug">{tier.forWhom}</p>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Setup Investment</div>
                            <div className={`font-bold leading-tight ${tier.setup === "Custom scope" ? "text-gray-500 text-sm" : "text-gray-900 text-sm"}`}>{tier.setup}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Monthly Platform Fee</div>
                            <div className={`font-bold leading-tight ${tier.monthly === "Custom scope" ? "text-gray-500 text-sm" : "text-gray-900 text-sm"}`}>{tier.monthly}</div>
                          </div>
                        </div>
                        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                          {tier.drivers.map((d: string, k: number) => (
                            <span key={k} className="text-xs bg-gray-100 border border-gray-200 text-gray-500 rounded-full px-2.5 py-0.5">{d}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                  {block.heading && (
                    <div className="text-orange-600 font-semibold text-sm mb-2">
                      {block.heading}
                    </div>
                  )}
                  {block.body && (
                    <p className="text-gray-700 text-sm leading-relaxed">{block.body}</p>
                  )}
                  {block.examples && (
                    <div className="space-y-3 mt-3">
                      {block.examples.map((ex: any, j: number) => (
                        <div key={j} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="text-orange-600 text-xs font-semibold mb-1">{ex.label}</div>
                          <p className="text-gray-600 text-xs leading-relaxed">{ex.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Application stage */}
        {(stage as any).isApplication && (
          <div className="mt-2 space-y-4 pb-8">
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
                Confirm all {(stage as any).checkboxes.length} statements before applying
              </p>
              {(stage as any).checkboxes.map((label: string, i: number) => (
                <button
                  key={i}
                  onClick={() => toggleAppCheck(i)}
                  className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    appChecks[i]
                      ? "bg-orange-50 border-orange-400"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      appChecks[i]
                        ? "bg-orange-600 border-orange-600 text-white"
                        : "border-gray-300 bg-transparent"
                    }`}
                  >
                    {appChecks[i] && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug">{label}</span>
                </button>
              ))}
            </div>

            {/* Application CTA — visible once all boxes checked */}
            <div className={`space-y-3 transition-opacity duration-300 ${allBoxesChecked ? "opacity-100" : "opacity-30 pointer-events-none select-none"}`}>
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-4 text-center space-y-1">
                <p className="text-orange-600 font-semibold text-sm">You're ready to apply.</p>
                <p className="text-gray-500 text-xs">The application opens in a new tab and takes approximately 5–8 minutes to complete.</p>
              </div>

              <a
                href="https://forms.gle/i6NsVnb3hirSgGTz5"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 rounded-xl font-semibold text-sm text-center bg-orange-600 text-white"
              >
                Open Partnership Application →
              </a>
              <p className="text-gray-400 text-xs text-center">
                Not a commitment. Our partnership team reviews every application personally.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Acknowledgment + Continue — non-application stages */}
      {!(stage as any).isApplication && (!(stage as any).isPathSelector || selectedTier !== null) && (
        <div className="px-4 pb-10 pt-2 flex-shrink-0 border-t border-gray-200 max-w-2xl mx-auto w-full">
          <button
            onClick={() => toggleAck(currentStage)}
            className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 mt-4 mb-3 transition-colors ${
              ackDone ? "bg-orange-50 border-orange-400" : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                ackDone ? "bg-orange-600 border-orange-600" : "border-gray-300 bg-transparent"
              }`}
            >
              {ackDone && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 leading-snug">{stage.ack}</span>
          </button>

          <button
            onClick={goNext}
            disabled={!ackDone}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              ackDone ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {currentStage === STAGES.length - 2
              ? "Proceed to Application →"
              : `Continue to Stage ${stage.number + 1} →`}
          </button>
        </div>
      )}
    </div>
  );
}
