import { Router } from "express";
import { db } from "../db";
import { userSmsSettings, smsLog, mealReminder } from "../db/schema/sms";
import { eq } from "drizzle-orm";

const r = Router();

// Upsert phone & consent
r.post("/settings", async (req, res) => {
  const userId = String(req.body?.userId || "1");
  const phoneE164 = String(req.body?.phoneE164 || "").trim();
  const consent = !!req.body?.consent;
  const timezone = String(req.body?.timezone || "America/Chicago");
  const quietStart = String(req.body?.quietStart || "21:00");
  const quietEnd = String(req.body?.quietEnd || "07:00");

  if (!/^\+\d{10,15}$/.test(phoneE164)) {
    return res.status(400).json({ error: "Invalid phone format. Use +1XXXXXXXXXX" });
  }

  const existing = (await db.select().from(userSmsSettings).where(eq(userSmsSettings.userId, userId))).at(0);
  
  if (!existing) {
    await db.insert(userSmsSettings).values({ 
      userId, phoneE164, consent, timezone, quietStart, quietEnd 
    });
  } else {
    await db.update(userSmsSettings)
      .set({ phoneE164, consent, timezone, quietStart, quietEnd, updatedAt: new Date() })
      .where(eq(userSmsSettings.userId, userId));
  }
  
  res.json({ ok: true, consent, phone: phoneE164 });
});

// Get current SMS settings
r.get("/settings", async (req, res) => {
  const userId = String(req.query?.userId || "1");
  
  const settings = (await db.select().from(userSmsSettings).where(eq(userSmsSettings.userId, userId))).at(0);
  
  if (!settings) {
    return res.json({ 
      consent: false, 
      phoneE164: "", 
      timezone: "America/Chicago", 
      quietStart: "21:00", 
      quietEnd: "07:00" 
    });
  }
  
  res.json({
    consent: settings.consent,
    phoneE164: settings.phoneE164,
    timezone: settings.timezone,
    quietStart: settings.quietStart,
    quietEnd: settings.quietEnd
  });
});

// Get SMS logs and reminders for user
r.get("/history", async (req, res) => {
  const userId = String(req.query?.userId || "1");
  
  const logs = await db.select().from(smsLog)
    .where(eq(smsLog.userId, userId))
    .orderBy(smsLog.createdAt)
    .limit(50);
    
  const reminders = await db.select().from(mealReminder)
    .where(eq(mealReminder.userId, userId))
    .orderBy(mealReminder.createdAt)
    .limit(50);
  
  res.json({ logs, reminders });
});

export default r;