import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { parsePhoneNumber } from "libphonenumber-js";
import twilio from "twilio";

const router = Router();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// GET phone state
router.get("/users/:userId/phone", async (req, res) => {
  try {
    const { userId } = req.params;
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return res.status(404).json({ error: "User not found" });
    
    return res.json({
      phoneE164: u.phoneE164 ?? null,
      phoneVerified: !!u.phoneVerified,
      smsConsent: !!u.smsConsent
    });
  } catch (error: any) {
    console.error("Failed to get phone state:", error);
    res.status(500).json({ error: error.message });
  }
});

// Request verification code
router.post("/users/:userId/phone/request-code", async (req, res) => {
  try {
    const { userId } = req.params;
    const raw = (req.body?.phone || "").toString().trim();
    
    const p = parsePhoneNumber(raw, "US"); // adjust default region if needed
    if (!p.isValid()) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    const e164 = p.number; // +1XXXXXXXXXX

    const code = ("" + Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
    await db.update(users).set({
      phoneE164: e164,
      phoneVerified: false,
      phoneVerificationCode: code
    }).where(eq(users.id, userId));

    // Send via Twilio
    await twilioClient.messages.create({
      to: e164,
      from: process.env.TWILIO_FROM_NUMBER!, // your Twilio number
      body: `Your My Perfect Meals code is ${code}. Reply STOP to opt out.`
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("Failed to send verification code:", e);
    return res.status(400).json({ error: e.message || "Failed to send verification code" });
  }
});

// Verify code
router.post("/users/:userId/phone/verify", async (req, res) => {
  try {
    const { userId } = req.params;
    const code = (req.body?.code || "").toString().trim();
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!u) return res.status(404).json({ error: "User not found" });
    if (!u.phoneVerificationCode || code !== u.phoneVerificationCode) {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    
    await db.update(users).set({
      phoneVerified: true,
      phoneVerificationCode: null,
      phoneVerifiedAt: new Date()
    }).where(eq(users.id, userId));
    
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to verify code:", error);
    return res.status(500).json({ error: error.message });
  }
});

// SMS consent
router.put("/users/:userId/sms-consent", async (req, res) => {
  try {
    const { userId } = req.params;
    const consent = !!req.body?.consent;

    await db.update(users).set({
      smsConsent: consent,
      smsConsentAt: consent ? new Date() : null
    }).where(eq(users.id, userId));

    // Update notification channels to include/exclude "sms"
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const channels = new Set((user?.notificationChannels as string[] || []));
    
    if (consent) {
      channels.add("sms");
    } else {
      channels.delete("sms");
    }

    await db.update(users).set({
      notificationChannels: Array.from(channels),
      notificationsEnabled: consent || channels.size > 0 // keep enabled if other channels exist
    }).where(eq(users.id, userId));

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to update SMS consent:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;