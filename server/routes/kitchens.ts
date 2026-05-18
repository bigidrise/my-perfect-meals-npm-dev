// server/routes/kitchens.ts
// Public-facing kitchen endpoints (auth required, no admin required).

import { Router } from "express";
import { db } from "../db";
import { creators, creatorSystemConfigs, users } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { sendEmail } from "../emailService";

const PARTNERSHIPS_EMAIL = "partnerships@myperfectmeals.com";

const router = Router();

// GET /api/kitchens/featured
// Returns kitchens where isVisible=true, ordered by displayPriority.
// Admins also see isVisible=false kitchens so they can preview their own.
router.get("/featured", async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const [adminRow] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, authReq.authUser.id))
      .limit(1);

    const isAdmin = adminRow?.isAdmin ?? false;

    const rows = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        isFeatured: creators.isFeatured,
        isActive: creators.isActive,
        displayPriority: creators.displayPriority,
        creatorCategory: creators.creatorCategory,
        configJson: creatorSystemConfigs.configJson,
      })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(
        isAdmin
          ? eq(creators.creatorCategory, "chef_kitchen")
          : and(eq(creators.isVisible, true), eq(creators.creatorCategory, "chef_kitchen"))
      )
      .orderBy(asc(creators.displayPriority));

    const kitchens = rows.map(r => {
      const cfg = (r.configJson as any) ?? {};
      return {
        slug: r.slug,
        displayName: r.displayName,
        bio: r.bio,
        logoUrl: r.logoUrl,
        heroImageUrl: r.heroImageUrl,
        brandingImageUrl: r.brandingImageUrl,
        isFeatured: r.isFeatured,
        isActive: r.isActive,
        displayPriority: r.displayPriority,
        creatorCategory: r.creatorCategory,
        cuisineTypes: cfg.cuisineTypes ?? [],
        flavorProfiles: cfg.style?.flavorProfiles ?? [],
        primaryColor: cfg.primaryColor ?? null,
      };
    });

    return res.json({ kitchens, isAdmin });
  } catch (err: any) {
    console.error("[Kitchens] featured error:", err);
    return res.status(500).json({ error: "Failed to fetch featured kitchens" });
  }
});

// GET /api/kitchens/:slug
// Admins see any kitchen regardless of visibility/active status.
// Regular users see kitchens where isVisible=true (advertised), with isActive in the response.
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const authReq = req as AuthenticatedRequest;
    const [adminRow] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, authReq.authUser.id))
      .limit(1);

    const isAdmin = adminRow?.isAdmin ?? false;

    const [row] = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        isFeatured: creators.isFeatured,
        creatorCategory: creators.creatorCategory,
        isActive: creators.isActive,
        isVisible: creators.isVisible,
        configJson: creatorSystemConfigs.configJson,
      })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, slug))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    // Admins bypass all gates; regular users need isVisible=true
    if (!isAdmin && !row.isVisible) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    const config = (row.configJson as any) ?? {};
    return res.json({
      slug: row.slug,
      displayName: row.displayName,
      bio: row.bio,
      logoUrl: row.logoUrl,
      heroImageUrl: row.heroImageUrl,
      brandingImageUrl: row.brandingImageUrl,
      isFeatured: row.isFeatured,
      creatorCategory: row.creatorCategory,
      isActive: row.isActive,
      isAdmin,
      cuisineTypes: config.cuisineTypes ?? [],
      flavorProfiles: config.style?.flavorProfiles ?? [],
      techniques: config.style?.techniques ?? [],
      primaryColor: config.primaryColor ?? null,
      accentColor: config.accentColor ?? null,
    });
  } catch (err: any) {
    console.error("[Kitchens] get error:", err);
    return res.status(500).json({ error: "Failed to fetch kitchen" });
  }
});

// POST /api/kitchens/partner-inquiry
// Receives a 5-step partnership intake form and emails the partnerships team.
// No auth required — prospective partners may not have accounts.
router.post("/partner-inquiry", async (req, res) => {
  try {
    const {
      fullName, chefBrandName, email, phone, location,
      cuisineFocus, cookingPhilosophy, signatureStyles, wellnessPhilosophy,
      youtube, instagram, tiktok, website,
      partnershipTypes,
    } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    const lines = [
      `== Signature Kitchen Partnership Application ==`,
      ``,
      `Name:          ${fullName}`,
      `Brand:         ${chefBrandName || "(not provided)"}`,
      `Email:         ${email}`,
      `Phone:         ${phone || "(not provided)"}`,
      `Location:      ${location || "(not provided)"}`,
      ``,
      `-- Culinary Identity --`,
      `Cuisine Focus:       ${cuisineFocus || "(not provided)"}`,
      `Cooking Philosophy:  ${cookingPhilosophy || "(not provided)"}`,
      `Signature Styles:    ${signatureStyles || "(not provided)"}`,
      `Wellness Philosophy: ${wellnessPhilosophy || "(not provided)"}`,
      ``,
      `-- Platform Presence --`,
      `YouTube:   ${youtube || "(not provided)"}`,
      `Instagram: ${instagram || "(not provided)"}`,
      `TikTok:    ${tiktok || "(not provided)"}`,
      `Website:   ${website || "(not provided)"}`,
      ``,
      `-- Partnership Interest --`,
      `Types: ${Array.isArray(partnershipTypes) ? partnershipTypes.join(", ") : "(not provided)"}`,
    ];

    const text = lines.join("\n");
    const html = `<pre style="font-family:monospace;font-size:13px;line-height:1.7">${text}</pre>`;

    await sendEmail({
      to: PARTNERSHIPS_EMAIL,
      subject: `Kitchen Partnership Application — ${fullName}${chefBrandName ? ` (${chefBrandName})` : ""}`,
      text,
      html,
    });

    console.log(`[Kitchens] Partner inquiry received from ${email}`);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Kitchens] partner-inquiry error:", err);
    return res.status(500).json({ message: "Failed to submit application. Please try again." });
  }
});

// POST /api/kitchens/contact-inquiry
// General partnerships contact form.
router.post("/contact-inquiry", async (req, res) => {
  try {
    const { name, email, company, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required." });
    }

    const text = [
      `== Kitchen Network Contact Form ==`,
      ``,
      `Name:    ${name}`,
      `Email:   ${email}`,
      `Company: ${company || "(not provided)"}`,
      `Subject: ${subject || "(not provided)"}`,
      ``,
      `Message:`,
      message,
    ].join("\n");

    const html = `<pre style="font-family:monospace;font-size:13px;line-height:1.7">${text}</pre>`;

    await sendEmail({
      to: PARTNERSHIPS_EMAIL,
      subject: `Kitchen Network Inquiry${subject ? ` — ${subject}` : ""} — ${name}`,
      text,
      html,
    });

    console.log(`[Kitchens] Contact inquiry received from ${email}`);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Kitchens] contact-inquiry error:", err);
    return res.status(500).json({ message: "Failed to send message. Please try again." });
  }
});

export default router;
