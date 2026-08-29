import type { Express, Request, Response } from "express";

const PUBLIC_ORIGIN = "https://app.myperfectmeals.com";

type MarketingPage = {
  title: string;
  description: string;
  image: string;
  heading: string;
  intro: string;
  sections: Array<{ heading: string; body: string; items?: string[] }>;
  cta?: { label: string; href: string };
  schemaType?: "WebPage" | "Product";
};

const MARKETING_PAGES: Record<string, MarketingPage> = {
  "/welcome": {
    title: "Personalized AI Meal Planning | My Perfect Meals",
    description:
      "My Perfect Meals is an AI nutrition coach in your pocket, creating meals around your goals, preferences, dietary needs, and real life.",
    image: "/assets/WelcomeChef2026.png",
    heading: "Welcome to My Perfect Meals",
    intro:
      "Meals built around your goals, your preferences, and your life. Get personalized nutrition guidance before you eat, not just another food log after the fact.",
    sections: [
      {
        heading: "A nutrition coach in your pocket",
        body:
          "My Perfect Meals helps you make smarter food decisions wherever you eat. Tell Chef what you need and receive practical meal ideas that fit your targets and food preferences.",
      },
      {
        heading: "Personalized to your health goals",
        body:
          "During setup, you share your goals, lifestyle, dietary identity, and relevant health considerations. The system uses that context to shape meal planning, nutrition targets, and safer food choices.",
      },
      {
        heading: "Guidance before the meal",
        body:
          "Plan complete days, generate recipes, organize groceries, and adapt meals when life changes. My Perfect Meals is designed to make consistency easier in the moments that matter.",
      },
    ],
    cta: { label: "Start with the guest experience", href: "/guest-builder" },
  },
  "/pricing": {
    title: "Plans & Pricing | My Perfect Meals",
    description:
      "Choose a My Perfect Meals plan for adaptive AI meal generation, personalized nutrition targets, recipe tools, grocery organization, and clinical support options.",
    image: "/assets/MPMTransparentLogo.png",
    heading: "Simple plans for personalized nutrition",
    intro:
      "Start with the tools that fit your routine and upgrade when you need more. Every plan is built around practical meal guidance, not generic calorie counting.",
    sections: [
      {
        heading: "Free",
        body: "Explore the My Perfect Meals experience and learn how the system works at your own pace.",
        items: ["Personalized setup", "Nutrition guidance", "A clear path to upgrade"],
      },
      {
        heading: "Essential — $19.99/month",
        body:
          "Daily adaptive nutrition with AI meal generation, Recipe Maker, Ingredient Intelligence, Fridge Rescue, grocery organization, and weekly meal planning.",
      },
      {
        heading: "Pro — $29.99/month",
        body:
          "The full creator suite with craving and dessert tools, beverage and sushi creation, restaurant guidance, gatherings, pairings, and pet nutrition.",
      },
      {
        heading: "Clinical — $44.99/month",
        body:
          "Advanced protocol and biomarker-guided nutrition with clinical lab integration, care team access, performance nutrition, and competition preparation.",
      },
      {
        heading: "Family and professional plans",
        body:
          "Family plans coordinate personalized profiles and shared shopping. ProCare connects clients with coaches, trainers, and physicians inside the platform.",
      },
    ],
    cta: { label: "Create your account", href: "/welcome" },
    schemaType: "Product",
  },
  "/guest-builder": {
    title: "Try the Guest Meal Builder | My Perfect Meals",
    description:
      "Experience personalized nutrition coaching with the My Perfect Meals guest builder. Set targets, plan complete meal days, and see how a coach in your pocket works.",
    image: "/images/planner-hero.png",
    heading: "Welcome to the MPM Guest Experience",
    intro:
      "This isn't a food app. It's a coach in your pocket — designed to help you eat well, enjoy food, and follow through.",
    sections: [
      {
        heading: "Experience real nutrition coaching",
        body:
          "You get four meal days to experience what personalized nutrition coaching feels like. Plan complete days, cook them, and live them.",
      },
      {
        heading: "Start with your personal targets",
        body:
          "Use the Macro Calculator to establish the nutrition foundation for your meal plan, then build meals around the targets that fit your goals.",
      },
      {
        heading: "Build meals and your shopping list",
        body:
          "Create complete meal days with practical recipes, then organize the ingredients you need. The guest experience is designed to show how planning supports consistency.",
      },
    ],
    cta: { label: "Start building meals", href: "/guest-builder" },
  },
  "/lifestyle": {
    title: "Lifestyle Nutrition Tools | My Perfect Meals",
    description:
      "Create meals for real life with My Perfect Meals lifestyle tools: custom dishes, craving adaptations, beverage guidance, pairings, fridge rescue, and more.",
    image: "/images/lifestyle-hero.png",
    heading: "Nutrition that fits your lifestyle",
    intro:
      "Healthy eating does not happen in a vacuum. My Perfect Meals helps you handle cravings, restaurants, beverages, leftovers, gatherings, and the choices that make up real life.",
    sections: [
      {
        heading: "Create food you actually want to eat",
        body:
          "Build custom dishes and healthier versions of cravings while keeping your preferences and nutrition direction in view.",
      },
      {
        heading: "Make better decisions away from home",
        body:
          "Use restaurant guidance, pairings, beverage tools, and social meal support to stay aligned without giving up the experiences you enjoy.",
      },
      {
        heading: "Turn what you have into a plan",
        body:
          "Fridge Rescue helps transform ingredients already in your kitchen into practical meals, reducing waste and eliminating the guesswork around dinner.",
      },
    ],
    cta: { label: "Explore the lifestyle tools", href: "/welcome" },
  },
  "/learn": {
    title: "Nutrition Learning Library | My Perfect Meals",
    description:
      "Learn how My Perfect Meals works, from AI meal generation and macro targets to dietary safety, clinical guardrails, grocery planning, and performance nutrition.",
    image: "/images/chef-hero-bg.png",
    heading: "Learn how My Perfect Meals works",
    intro:
      "The My Perfect Meals learning library explains the systems behind your meal guidance in clear, practical language.",
    sections: [
      {
        heading: "How meal generation works",
        body:
          "Learn how your protein, carbohydrate, and fat targets, dietary preferences, and health context shape recipes and meal recommendations.",
      },
      {
        heading: "Nutrition strategy for real life",
        body:
          "Explore meal planning, grocery organization, cravings, dining out, hydration, performance nutrition, and the habits that make a plan sustainable.",
      },
      {
        heading: "Health and safety",
        body:
          "Understand the guardrails used for allergies, diabetes, metabolic medication, inflammation, and other situations where food guidance needs extra care.",
      },
    ],
    cta: { label: "Open the learning library", href: "/learn" },
  },
  "/creator-studio": {
    title: "Creator Studio | Build Your Branded Nutrition System",
    description:
      "Creator Studio turns your cooking identity, techniques, and flavor philosophy into a custom meal and nutrition system your audience can use inside My Perfect Meals.",
    image: "/images/kitchen-marquee-hero.png",
    heading: "Creator Studio",
    intro:
      "We build a custom system inside My Perfect Meals — your style, your identity, your audience.",
    sections: [
      {
        heading: "Chef Studio",
        body:
          "Turn your cooking identity into a system your audience can actually use. Your techniques, flavor philosophy, and style shape every meal generated under your name.",
        items: [
          "Your studio name and identity in the platform",
          "Your cooking techniques and flavors power the AI",
          "A signature meal catalog for your audience",
          "A product code gives your community access",
        ],
      },
      {
        heading: "Brand Beverage Studio",
        body:
          "Put your branded products into the supplement and beverage experience with product names, labels, and recommendations integrated by the My Perfect Meals team.",
      },
      {
        heading: "Built for creators",
        body:
          "Every Creator Studio is reviewed and built by our team. Applications are not automatically activated; we contact you to confirm the scope and next steps.",
      },
    ],
    cta: { label: "Apply for Creator Studio", href: "/creator/start" },
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonLd(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function pageUrl(route: string): string {
  return `${PUBLIC_ORIGIN}${route}`;
}

function metadataTags(route: string, page: MarketingPage): string {
  const canonical = pageUrl(route);
  const socialImage = pageUrl(page.image);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": page.schemaType ?? "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "My Perfect Meals",
      url: PUBLIC_ORIGIN,
    },
    ...(page.schemaType === "Product"
      ? {
          brand: { "@type": "Brand", name: "My Perfect Meals" },
          offers: [
            { "@type": "Offer", name: "Essential", price: "19.99", priceCurrency: "USD", url: canonical },
            { "@type": "Offer", name: "Pro", price: "29.99", priceCurrency: "USD", url: canonical },
            { "@type": "Offer", name: "Clinical", price: "44.99", priceCurrency: "USD", url: canonical },
          ],
        }
      : {}),
  };

  return `
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:site_name" content="My Perfect Meals" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${socialImage}" />
    <meta property="og:image:alt" content="${escapeHtml(page.heading)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${socialImage}" />
    <script type="application/ld+json">${escapeJsonLd(JSON.stringify(jsonLd))}</script>`;
}

function pageBody(page: MarketingPage): string {
  const sections = page.sections
    .map(
      (section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
          ${
            section.items
              ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
              : ""
          }
        </section>`,
    )
    .join("");

  return `
    <header class="site-header">
      <a class="brand" href="/">My Perfect Meals</a>
      <nav aria-label="Primary navigation">
        <a href="/learn">Learn</a>
        <a href="/pricing">Pricing</a>
        <a href="/auth">Sign in</a>
      </nav>
    </header>
    <main>
      <article>
        <p class="eyebrow">MY PERFECT MEALS</p>
        <h1>${escapeHtml(page.heading)}</h1>
        <p class="intro">${escapeHtml(page.intro)}</p>
        ${sections}
        ${
          page.cta
            ? `<p class="cta"><a href="${escapeHtml(page.cta.href)}">${escapeHtml(page.cta.label)} <span aria-hidden="true">→</span></a></p>`
            : ""
        }
      </article>
    </main>
    <footer>
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </footer>`;
}

const SSR_STYLES = `
    <style>
      :root { color-scheme: dark; }
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body { background: #050505; color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.65; }
      .site-header { align-items: center; border-bottom: 1px solid #292929; display: flex; gap: 24px; justify-content: space-between; padding: 20px max(24px, calc((100% - 920px) / 2)); }
      .brand, nav a, footer a { color: #f5f5f5; text-decoration: none; }
      .brand { font-size: 1.05rem; font-weight: 800; letter-spacing: -.02em; }
      nav { display: flex; flex-wrap: wrap; gap: 18px; }
      nav a, footer a { color: #c8c8c8; font-size: .9rem; }
      nav a:hover, footer a:hover { color: #fb923c; }
      main { margin: 0 auto; max-width: 920px; padding: 76px 24px 64px; }
      article { max-width: 760px; }
      .eyebrow { color: #fb923c; font-size: .75rem; font-weight: 800; letter-spacing: .16em; margin: 0 0 14px; }
      h1 { font-size: clamp(2.15rem, 7vw, 4rem); line-height: 1.08; letter-spacing: -.045em; margin: 0 0 22px; }
      h2 { color: #fff; font-size: 1.25rem; line-height: 1.25; margin: 42px 0 10px; }
      p { color: #d1d1d1; font-size: 1rem; margin: 0 0 12px; }
      .intro { color: #f0f0f0; font-size: 1.2rem; line-height: 1.55; max-width: 680px; }
      ul { color: #d1d1d1; padding-left: 24px; }
      li { margin: 5px 0; }
      .cta { margin-top: 48px; }
      .cta a { background: #ea580c; border-radius: 10px; color: #fff; display: inline-block; font-weight: 750; padding: 12px 18px; text-decoration: none; }
      .cta a:hover { background: #f97316; }
      footer { border-top: 1px solid #292929; display: flex; gap: 20px; margin: 0 auto; max-width: 920px; padding: 24px; }
      @media (max-width: 560px) { .site-header { align-items: flex-start; flex-direction: column; gap: 10px; } main { padding-top: 52px; } }
    </style>`;

function replaceHeadMetadata(template: string, tags: string): string {
  const withoutManagedTags = template
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*\/?>/gi, "")
    .replace(/<meta\s+[^>]*name=["']robots["'][^>]*\/?>/gi, "")
    .replace(/<meta\s+[^>]*name=["']twitter:[^"']+["'][^>]*\/?>/gi, "")
    .replace(/<meta\s+[^>]*property=["']og:[^"']+["'][^>]*\/?>/gi, "")
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*\/?>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "");
  return withoutManagedTags.replace(/<\/head>/i, `${tags}\n${SSR_STYLES}\n</head>`);
}

export function getMarketingPage(route: string): MarketingPage | null {
  return MARKETING_PAGES[route] ?? null;
}

/**
 * Adds a meaningful, crawlable page to the existing client shell. Keeping the
 * original module scripts means humans still receive the full interactive SPA
 * after the initial HTML has loaded.
 */
export function renderMarketingSsr(route: string, template: string): string | null {
  const page = getMarketingPage(route);
  if (!page) return null;

  const html = replaceHeadMetadata(template, metadataTags(route, page));
  const body = pageBody(page);
  const rootPattern = /<div\s+id=["']root["']\s*><\/div>/i;
  if (!rootPattern.test(html)) return null;
  return html.replace(rootPattern, `<div id="root">${body}</div>`);
}

export function registerMarketingSsrRoutes(
  app: Express,
  getTemplate: () => string | Promise<string>,
): void {
  for (const route of Object.keys(MARKETING_PAGES)) {
    app.get(route, async (_req: Request, res: Response, next) => {
      try {
        const template = await getTemplate();
        const rendered = renderMarketingSsr(route, template);
        if (!rendered) return next();
        res
          .status(200)
          .set({ "Content-Type": "text/html; charset=utf-8" })
          .send(rendered);
      } catch (error) {
        next(error);
      }
    });
  }
}