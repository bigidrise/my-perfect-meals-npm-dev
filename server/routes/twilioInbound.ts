import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/twilio/inbound-sms", async (req, res) => {
  try {
    const from = (req.body?.From || "").toString().trim();
    const body = (req.body?.Body || "").toString().trim().toUpperCase();

    if (!from) return res.type("text/xml").send("<Response/>");

    if (body === "STOP" || body === "STOP ALL" || body === "UNSUBSCRIBE" || body === "CANCEL" || body === "END" || body === "QUIT") {
      await db.update(users).set({ 
        smsConsent: false,
        smsConsentAt: null 
      }).where(eq(users.phoneE164, from));
      
      // Send confirmation
      return res.type("text/xml").send(`<Response><Message>You have been unsubscribed from SMS reminders. Reply START to re-subscribe.</Message></Response>`);
    }

    if (body === "START") {
      await db.update(users).set({ 
        smsConsent: true,
        smsConsentAt: new Date()
      }).where(eq(users.phoneE164, from));
      
      return res.type("text/xml").send(`<Response><Message>You've been re-subscribed. You will receive meal reminders.</Message></Response>`);
    }

    if (body === "HELP") {
      return res.type("text/xml").send(`<Response><Message>My Perfect Meals: Reply STOP to unsubscribe. Standard msg/data rates may apply.</Message></Response>`);
    }

    return res.type("text/xml").send("<Response/>");
  } catch (error: any) {
    console.error("Failed to process inbound SMS:", error);
    return res.type("text/xml").send("<Response/>");
  }
});

export default router;