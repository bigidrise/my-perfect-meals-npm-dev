import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import { setNoStoreHeaders } from "./staticDelivery";

const SITE_ORIGIN = "https://app.myperfectmeals.com";

type MarketingPage = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    items?: string[];
  }>;
  ctaLabel: string;
  ctaHref: string;
};

const MARKETING_PAGES: Record<string, MarketingPage> = {
  "/welcome": {
    title: "AI-Powered Personalized Meal Planning | My Perfect Meals",
    description:
      "My Perfect Meals is an AI-powered nutrition coach for personalized meal planning, dietary needs, health goals, and real-life food decisions.",
    heading: "A nutrition coach in your pocket",
    intro:
      "My Perfect Meals creates personalized meals around your goals, preferences, lifestyle, and health considerations. Get practical nutrition guidance before you eat, wherever real life takes you.",
    sections: [
      {
        heading: "Personalized meal planning",
        paragraphs: [
          "Start with your goals, dietary preferences, lifestyle, and health inputs. The app uses that profile to shape nutrition targets and meal ideas that fit you instead of serving generic recipes.",
        ],
        items: [
          "AI-generated meals built around your personal profile",
          "Macro-aware weekly meal planning",
          "Saved meals, favorites, and grocery organization",
        ],
      },
      {
        heading: "Nutrition guidance for real life",
        paragraphs: [
          "Use My Perfect Meals when you are cooking at home, deciding what to make from your fridge, ordering at a restaurant, traveling, or managing a craving. The goal is useful direction in the moment, not just a food log after the fact.",
        ],
        items: [
          "Fridge Rescue for meals from ingredients you already have",
          "Restaurant and fast-food guidance",
          "Meal, dessert, beverage, and pairing tools",
        ],
      },
      {
        heading: "Health-aware guardrails",
        paragraphs: [
          "The platform can account for dietary restrictions and health considerations such as diabetes, inflammation, allergies, and metabolic medication protocols. Its safety features are designed to guide food choices more responsibly.",
          "My Perfect Meals is not a medical service and does not diagnose, treat, or cure disease. Consult a qualified healthcare provider before changing your diet, medication, or lifestyle.",
        ],
      },
    ],
    ctaLabel: "Explore plans",
    ctaHref: "/pricing",
  },
  "/pricing": {
    title: "Pricing and Plans | My Perfect Meals",
    description:
      "Compare My Perfect Meals plans for personalized AI meal planning, family nutrition, clinical protocols, and professional coaching.",
    heading: "Plans for personalized nutrition",
    intro:
      "Choose the level of nutrition support that fits your life. Every plan is designed to make personalized meal decisions easier, from everyday planning to family and clinical support.",
    sections: [
      {
        heading: "Individual plans",
        items: [
          "Free — $0 per month: explore the app at your own pace",
          "Essential — $19.99 per month: AI meal generation, Recipe Maker, Ingredient Intelligence, Fridge Rescue, weekly planning, and grocery organization",
          "Pro — $29.99 per month: everything in Essential plus Craving Creator, Dessert Creator, Beverage Creator, Sushi Creator, restaurant guidance, gatherings, pairings, and pet nutrition",
          "Clinical — $44.99 per month: everything in Pro plus clinical lab integration, care team access, performance nutrition, and clinical advisory support",
        ],
      },
      {
        heading: "Family plans",
        paragraphs: [
          "Family plans give each household member a personalized nutrition profile while keeping meal planning and shopping coordinated.",
        ],
        items: [
          "Family Essential — $54.99 per month for up to 4 profiles",
          "Family Pro — $109.99 per month with creator tools for up to 4 profiles",
          "Family Clinical — $169.99 per month with clinical features for up to 4 profiles",
        ],
      },
      {
        heading: "Professional support",
        paragraphs: [
          "ProCare plans help trainers, coaches, and physicians manage client or patient nutrition inside My Perfect Meals with dashboards, meal-builder assignments, macro targets, messaging, and progress monitoring.",
        ],
        items: [
          "Trainer plans for teams managing up to 5, 10, 25, or 50+ clients",
          "Physician plans for practices managing up to 50 or 150 patients",
          "Personal Guidance for direct nutrition coaching and meal adjustments",
        ],
      },
    ],
    ctaLabel: "Start with My Perfect Meals",
    ctaHref: "/welcome",
  },
  "/lifestyle": {
    title: "Lifestyle Nutrition Tools | My Perfect Meals",
    description:
      "Explore My Perfect Meals lifestyle tools for AI meal creation, cravings, beverages, pairings, fridge ingredients, restaurants, gatherings, and pets.",
    heading: "Lifestyle tools for real food decisions",
    intro:
      "Healthy eating has to work outside a perfect kitchen. My Perfect Meals brings personalized nutrition guidance into the moments that usually make food choices difficult.",
    sections: [
      {
        heading: "Create meals around what you want",
        paragraphs: [
          "Create a Dish turns your idea into a meal shaped around your nutrition profile. Craving Creator and Dessert Creator help you enjoy the foods you want while staying aligned with your plan.",
        ],
        items: [
          "Create a Dish for personalized AI recipes",
          "Craving Creator and Dessert Creator",
          "Fridge Rescue using ingredients already on hand",
        ],
      },
      {
        heading: "Navigate drinks, restaurants, and gatherings",
        paragraphs: [
          "When you are away from home, the app helps you make a better next decision. Explore beverage ideas, wine and spirit pairings, restaurant guidance, fast-food options, and meals for gatherings.",
        ],
        items: [
          "Beverage Creator and Sushi Creator",
          "Restaurant Guide, Fast Food Guide, and Find Meals Near Me",
          "Pairing tools and My Perfect Gatherings",
        ],
      },
      {
        heading: "Personalized support beyond your plate",
        paragraphs: [
          "Lifestyle nutrition can include the people and animals you care for. Family planning coordinates different household needs, while My Perfect Pets provides AI nutrition and meal planning support for pets.",
        ],
        items: [
          "Family profiles and shared shopping lists",
          "My Perfect Pets nutrition and meal plans",
          "Optional professional coaching through ProCare",
        ],
      },
    ],
    ctaLabel: "See the plans",
    ctaHref: "/pricing",
  },
  "/learn": {
    title: "Nutrition Education and App Guide | My Perfect Meals",
    description:
      "Learn how My Perfect Meals builds personalized nutrition, applies meal builders, uses AI, tracks macros, and adds health and safety guidance.",
    heading: "Learn how My Perfect Meals works",
    intro:
      "The My Perfect Meals learning library explains the systems behind personalized meal planning, from your first profile to daily nutrition decisions and specialized health support.",
    sections: [
      {
        heading: "How personalized nutrition is built",
        paragraphs: [
          "Your goals, health inputs, dietary identity, lifestyle, and food preferences help determine the nutrition builder that fits your situation. The system can then shape meals, targets, and ingredient choices around that context.",
        ],
        items: [
          "Weekly meal planning for general nutrition goals",
          "Diabetic and metabolic medication nutrition builders",
          "Anti-inflammatory and performance nutrition support",
        ],
      },
      {
        heading: "How meal generation and tracking work",
        paragraphs: [
          "The app combines AI meal creation with macro targets, preferences, and protocol rules. It is designed to help you make a food decision before you eat, then track progress through the day.",
        ],
        items: [
          "Macro Calculator and daily nutrition budget",
          "Ingredient Intelligence and protocol-aware analysis",
          "Smart shopping lists, saved meals, and favorites",
        ],
      },
      {
        heading: "Health, safety, and responsible use",
        paragraphs: [
          "Health-aware layers can support dietary restrictions, allergies, diabetes, inflammation, and other clinical considerations. These tools are intended to provide structured nutrition guidance, not medical advice.",
          "Always verify nutrition information and speak with your physician or qualified healthcare provider before making changes related to a medical condition or medication.",
        ],
      },
    ],
    ctaLabel: "Begin your nutrition plan",
    ctaHref: "/welcome",
  },
};

const FALLBACK_PAGE: MarketingPage = {
  title: "My Perfect Meals",
  description:
    "AI-powered meal planning personalized to health goals, dietary needs, and medical conditions.",
  heading: "Personalized nutrition for real life",
  intro:
    "My Perfect Meals combines AI meal planning, nutrition tracking, and health-aware food guidance in one place.",
  sections: [],
  ctaLabel: "Get started",
  ctaHref: "/welcome",
};

export const MARKETING_PATHS = Object.keys(MARKETING_PAGES);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderSection(section: MarketingPage["sections"][number]): string {
  const paragraphs = (section.paragraphs ?? [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const items = section.items?.length
    ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${items}</section>`;
}

function renderMarketingContent(page: MarketingPage): string {
  const sections = page.sections.map(renderSection).join("");

  return `
    <div class="seo-shell" data-seo-page>
      <header class="seo-header">
        <a class="seo-brand" href="/welcome">My Perfect Meals</a>
        <nav aria-label="Primary navigation">
          <a href="/pricing">Pricing</a>
          <a href="/lifestyle">Lifestyle</a>
          <a href="/learn">Learn</a>
        </nav>
      </header>
      <main>
        <p class="seo-eyebrow">AI-powered nutrition guidance</p>
        <h1>${escapeHtml(page.heading)}</h1>
        <p class="seo-intro">${escapeHtml(page.intro)}</p>
        ${sections}
        <p><a class="seo-cta" href="${page.ctaHref}">${escapeHtml(page.ctaLabel)}</a></p>
      </main>
      <footer>
        <p>My Perfect Meals helps people make personalized food decisions around their goals, preferences, and health considerations.</p>
        <p><a href="/welcome">Welcome</a> · <a href="/pricing">Pricing</a> · <a href="/lifestyle">Lifestyle</a> · <a href="/learn">Learn</a></p>
      </footer>
    </div>`;
}

function schemaForPage(pathname: string, page: MarketingPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: `${SITE_ORIGIN}${pathname}`,
    isPartOf: {
      "@type": "WebSite",
      name: "My Perfect Meals",
      url: `${SITE_ORIGIN}/`,
    },
    about: {
      "@type": "SoftwareApplication",
      name: "My Perfect Meals",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "AI-powered meal planning personalized to health goals, dietary needs, and medical conditions.",
    },
  };
}

function replaceMetaTag(template: string, pattern: RegExp, tag: string): string {
  return pattern.test(template) ? template.replace(pattern, tag) : template;
}

/**
 * Adds the route's public content to the HTML shell. The client still mounts
 * normally into #root; this content is the meaningful initial document that
 * crawlers and no-JavaScript visitors can read before that mount occurs.
 */
export function renderMarketingPage(template: string, pathname: string): string {
  const normalizedPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const page = MARKETING_PAGES[normalizedPath] ?? FALLBACK_PAGE;
  const canonicalPath = MARKETING_PAGES[normalizedPath] ? normalizedPath : "/welcome";
  let rendered = template;

  rendered = replaceMetaTag(
    rendered,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${SITE_ORIGIN}${canonicalPath}" />`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
  );
  rendered = replaceMetaTag(
    rendered,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
  );

  const canonical = `<link rel="canonical" href="${SITE_ORIGIN}${canonicalPath}" />`;
  rendered = rendered.includes('rel="canonical"')
    ? rendered.replace(/<link\s+rel="canonical"[^>]*\/?>/i, canonical)
    : rendered.replace("</head>", `    ${canonical}\n  </head>`);

  const structuredData = `<script type="application/ld+json">${JSON.stringify(schemaForPage(canonicalPath, page))}</script>`;
  rendered = rendered.includes('type="application/ld+json"')
    ? rendered.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, structuredData)
    : rendered.replace("</head>", `    ${structuredData}\n  </head>`);

  const content = renderMarketingContent(page);
  const rootMarker = '<div id="root"><!-- SEO fallback --></div>';
  if (rendered.includes(rootMarker)) {
    return rendered.replace(rootMarker, `<div id="root">${content}</div>`);
  }

  return rendered.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

export function registerMarketingPageRoutes(app: Express, templatePath: string): void {
  for (const pathname of MARKETING_PATHS) {
    app.get(pathname, (_req: Request, res: Response, next: NextFunction) => {
      try {
        const template = fs.readFileSync(path.resolve(templatePath), "utf8");
        setNoStoreHeaders(res);
        res.type("html").send(renderMarketingPage(template, pathname));
      } catch (error) {
        next(error);
      }
    });
  }
}