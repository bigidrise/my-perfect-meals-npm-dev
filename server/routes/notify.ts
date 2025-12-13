import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import twilio from "twilio";

const router = Router();
const tw = process.env.TWILIO_SID && process.env.TWILIO_TOKEN 
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  : null;

/** Web Push token register */
router.post("/notify/register-push", async (req, res) => {
  try {
    const { userId, subscription } = req.body; // subscription is the Web Push endpoint+keys
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    const tokens = Array.isArray(u?.pushTokens) ? u!.pushTokens : [];
    tokens.push(subscription);
    await db.update(users).set({ pushTokens: tokens }).where(eq(users.id, userId));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({ error: "Failed to register push token" });
  }
});

/** SMS verify start */
router.post("/notify/sms/start", async (req, res) => {
  try {
    if (!tw || !process.env.TWILIO_FROM) {
      return res.status(503).json({ error: "SMS service not available" });
    }
    
    const { userId, phone } = req.body;
    const code = (Math.floor(100000 + Math.random()*900000)).toString();
    await db.update(users).set({ 
      phone, 
      phoneVerified: false, 
      smsOptIn: false 
    }).where(eq(users.id, userId));
    
    await tw.messages.create({ 
      from: process.env.TWILIO_FROM, 
      to: phone, 
      body: `My Perfect Meals verification code: ${code}` 
    });
    
    // TODO: store code in server-side cache (Redis) with TTL 10m
    // redis.set(`otp:${userId}`, code, 'EX', 600)
    res.json({ ok: true });
  } catch (error) {
    console.error("Error starting SMS verification:", error);
    res.status(500).json({ error: "Failed to start SMS verification" });
  }
});

/** SMS verify complete */
router.post("/notify/sms/verify", async (req, res) => {
  try {
    const { userId, code } = req.body;
    // TODO: const ok = await redis.get(`otp:${userId}`) === code;
    const ok = true; // stub for now
    if (!ok) return res.status(400).json({ error: "Invalid code" });
    
    await db.update(users).set({ 
      phoneVerified: true, 
      smsOptIn: true 
    }).where(eq(users.id, userId));
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error verifying SMS code:", error);
    res.status(500).json({ error: "Failed to verify SMS code" });
  }
});

/** Twilio inbound webhook: STOP/START/SNOOZE/SKIP */
router.post("/notify/sms/inbound", async (req, res) => {
  try {
    const body = (req.body.Body || "").trim().toUpperCase();
    const from = req.body.From;
    
    if (body === "STOP") {
      await db.update(users).set({ smsOptIn: false }).where(eq(users.phone as any, from));
    } else if (body === "START") {
      await db.update(users).set({ smsOptIn: true }).where(eq(users.phone as any, from));
    }
    // TODO: handle "SNOOZE" or "SKIP" by parsing recent job for that user
    
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    console.error("Error handling inbound SMS:", error);
    res.type("text/xml").send("<Response></Response>");
  }
});

export default router;