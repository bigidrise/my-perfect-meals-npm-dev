import React, { useState } from "react";

const TOTAL = 13;

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
        body: "A client starts GLP-1 medication. Another develops kidney issues. Someone goes on vacation and wants different cuisine. Someone else simply gets bored of the plan. In most platforms, every one of those changes lands back on the professional as a manual task.",
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
        body: "Traditional platforms help you manage clients. My Perfect Meals helps you manage both the client experience and the nutrition experience. Coaches, dietitians, and healthcare professionals remain in control of the relationship while the platform continuously adapts meals, recipes, shopping, and nutrition recommendations to the individual.",
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
        heading: "Licensing model.",
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
    ],
    ack: null,
  },
];

const WHAT_HAPPENS_NEXT = [
  {
    step: 1,
    title: "Initial review and fit assessment",
    body: "Our partnership team reviews every application personally. You'll receive a response confirming receipt and whether your use case is a strong fit for the program.",
  },
  {
    step: 2,
    title: "Discovery call scheduled",
    body: "If your application indicates a strong fit, we'll schedule a 45-minute discovery call to understand your use case, member profile, and clinical requirements.",
  },
  {
    step: 3,
    title: "Proposal & investment breakdown",
    body: "Following the discovery call, we deliver a written proposal with your specific platform fee, setup cost, and configuration scope.",
  },
  {
    step: 4,
    title: "Agreement & kickoff",
    body: "Once terms are agreed, you sign the partnership agreement and we schedule your Week 1 kickoff. The 12-week clock starts here.",
  },
  {
    step: 5,
    title: "Environment delivery",
    body: "Week 5: your staging environment is delivered for review. Week 12: production goes live.",
  },
  {
    step: 6,
    title: "Your branded product is live",
    body: "Your members log in to your app, with your name on it, powered by MPM's AI — and none of them will ever know we exist.",
  },
];

export default function WhiteLabelJourney() {
  const [currentStage, setCurrentStage] = useState(0);
  const [acknowledged, setAcknowledged] = useState<boolean[]>(
    new Array(STAGES.length).fill(false)
  );
  const [appChecks, setAppChecks] = useState<boolean[]>(
    new Array(9).fill(false)
  );
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    business: "",
    audience: "",
    useCase: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const stage = STAGES[currentStage];
  const isLast = currentStage === STAGES.length - 1;
  const ackDone = acknowledged[currentStage];
  const allBoxesChecked = appChecks.every(Boolean);
  const formValid =
    formData.name.trim() &&
    formData.email.trim() &&
    formData.business.trim() &&
    formData.useCase.trim();
  const canSubmit = allBoxesChecked && formValid;

  function goBack() {
    if (currentStage > 0) setCurrentStage((s) => s - 1);
  }

  function goNext() {
    if (!isLast && ackDone) setCurrentStage((s) => s + 1);
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-orange-950 to-black text-white flex flex-col">
        <div className="px-4 pt-10 pb-6 text-center">
          <div className="text-orange-400 text-4xl mb-3">✓</div>
          <h1 className="text-2xl font-bold mb-2">Application Submitted</h1>
          <p className="text-white/60 text-sm">
            You'll hear from us after our initial review.
          </p>
        </div>

        <div className="px-4 space-y-3 flex-1 overflow-y-auto pb-8">
          <h2 className="text-orange-400 font-semibold text-sm uppercase tracking-wider mb-4">
            What Happens Next
          </h2>
          {WHAT_HAPPENS_NEXT.map((item) => (
            <div
              key={item.step}
              className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-sm font-bold">
                {item.step}
              </div>
              <div>
                <div className="font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-white/60 text-xs leading-relaxed">
                  {item.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-orange-950 to-black text-white flex flex-col">
      {/* Progress header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">
            Stage {stage.number} of {TOTAL}
          </span>
          {currentStage > 0 && (
            <button
              onClick={goBack}
              className="text-white/40 text-xs underline"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(stage.number / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Stage content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-2">
          <h1 className="text-xl font-bold leading-tight mb-1">{stage.title}</h1>
          <p className="text-white/50 text-sm">{stage.subtitle}</p>
        </div>

        {/* Regular stage content */}
        {!stage.isApplication && (
          <div className="space-y-4 mt-4">
            {(stage.content as any[]).map((block: any, i: number) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-orange-300 font-semibold text-sm mb-2">
                  {block.heading}
                </div>
                {block.body && (
                  <div className="text-white/70 text-sm leading-relaxed">
                    {block.body}
                  </div>
                )}
                {block.examples && (
                  <div className="space-y-3 mt-3">
                    {block.examples.map((ex: any, j: number) => (
                      <div
                        key={j}
                        className="bg-white/5 border border-white/10 rounded-lg p-3"
                      >
                        <div className="text-orange-400 text-xs font-semibold mb-1">
                          {ex.label}
                        </div>
                        <div className="text-white/60 text-xs leading-relaxed">
                          {ex.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Application stage */}
        {stage.isApplication && (
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">
                Confirm all {(stage as any).checkboxes.length} statements before applying
              </p>
              {(stage as any).checkboxes.map((label: string, i: number) => (
                <button
                  key={i}
                  onClick={() => toggleAppCheck(i)}
                  className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-all ${
                    appChecks[i]
                      ? "bg-orange-600/20 border-orange-500"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-all ${
                      appChecks[i]
                        ? "bg-orange-600 border-orange-600 text-white"
                        : "border-white/30"
                    }`}
                  >
                    {appChecks[i] ? "✓" : ""}
                  </div>
                  <span className="text-sm text-white/80 leading-snug">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Form — fades in once all boxes checked */}
            <div
              className={`space-y-3 transition-all duration-300 ${
                allBoxesChecked
                  ? "opacity-100"
                  : "opacity-30 pointer-events-none"
              }`}
            >
              <p className="text-white/50 text-xs uppercase tracking-wider font-semibold pt-2">
                Your Information
              </p>

              {[
                { key: "name", label: "Full Name", placeholder: "Your full name" },
                { key: "email", label: "Business Email", placeholder: "you@yourbusiness.com" },
                { key: "business", label: "Business / Practice Name", placeholder: "Your organization name" },
                {
                  key: "audience",
                  label: "Estimated Audience or Member Size",
                  placeholder: "e.g. 200 active clients, 5,000 newsletter subscribers",
                },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-white/50 text-xs mb-1 block">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}

              <div>
                <label className="text-white/50 text-xs mb-1 block">
                  Describe your use case in 2–3 sentences
                </label>
                <textarea
                  rows={4}
                  placeholder="Who are your members, what clinical needs do they have, and what would a branded nutrition app do for your business?"
                  value={formData.useCase}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, useCase: e.target.value }))
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <button
                onClick={() => canSubmit && setSubmitted(true)}
                className={`w-full py-4 rounded-xl font-semibold text-sm transition-all ${
                  canSubmit
                    ? "bg-orange-600 text-white"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                Submit Application
              </button>
              <p className="text-white/30 text-xs text-center pb-2">
                Not a commitment. We'll review and respond after our initial fit assessment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Acknowledgment + Continue — non-application stages */}
      {!stage.isApplication && (
        <div className="px-4 pb-8 pt-2 flex-shrink-0 border-t border-white/10">
          <button
            onClick={() => toggleAck(currentStage)}
            className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 mt-3 mb-3 transition-all ${
              ackDone
                ? "bg-orange-600/20 border-orange-500"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-all ${
                ackDone
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "border-white/30"
              }`}
            >
              {ackDone ? "✓" : ""}
            </div>
            <span className="text-sm text-white/80 leading-snug">{stage.ack}</span>
          </button>

          <button
            onClick={goNext}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-all ${
              ackDone
                ? "bg-orange-600 text-white"
                : "bg-white/10 text-white/30 cursor-not-allowed"
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
