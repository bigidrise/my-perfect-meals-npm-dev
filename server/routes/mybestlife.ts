import { Router } from "express";
import { db } from "../db";
import { and, eq, asc } from "drizzle-orm";
import { mblAvatarState, mblDayLog } from "../db/schema/mybestlife";
import { tickDay, MblState } from "../services/mblSim";

const r = Router();
const ENABLED = process.env.MYBESTLIFE_ENABLED === "true";
const todayKey = () => new Date().toISOString().slice(0,10);

r.use((req,res,next)=> ENABLED ? next() : res.status(404).json({ error:"My Best Life disabled" }));

r.get("/state", async (req,res)=>{
  const userId = String(req.query.userId || "1");
  let row = (await db.select().from(mblAvatarState).where(eq(mblAvatarState.userId, userId))).at(0);
  if (!row) {
    await db.insert(mblAvatarState).values({ userId, lastSimDate: todayKey() });
    row = (await db.select().from(mblAvatarState).where(eq(mblAvatarState.userId, userId))).at(0);
  }
  res.json({ state: row });
});

r.post("/day/set", async (req,res)=>{
  const userId = String(req.body?.userId || "1");
  const dateKey = String(req.body?.dateKey || todayKey());
  const nutritionScore = Number(req.body?.nutritionScore ?? 50);
  const trainingScore  = Number(req.body?.trainingScore ?? 0);
  const lifestyleScore = Number(req.body?.lifestyleScore ?? 50);
  const mealNames: string[] = Array.isArray(req.body?.mealNames) ? req.body.mealNames : [];
  const workoutName = String(req.body?.workoutName || "");

  const existing = (await db.select().from(mblDayLog)
    .where(and(eq(mblDayLog.userId, userId), eq(mblDayLog.dateKey, dateKey)))).at(0);

  if (!existing) {
    await db.insert(mblDayLog).values({ 
      userId, dateKey, 
      nutritionScore: nutritionScore.toString(), 
      trainingScore: trainingScore.toString(), 
      lifestyleScore: lifestyleScore.toString(), 
      mealNames, workoutName 
    });
  } else {
    await db.update(mblDayLog).set({ 
      nutritionScore: nutritionScore.toString(), 
      trainingScore: trainingScore.toString(), 
      lifestyleScore: lifestyleScore.toString(), 
      mealNames, workoutName 
    }).where(and(eq(mblDayLog.userId, userId), eq(mblDayLog.dateKey, dateKey)));
  }
  res.json({ ok:true });
});

r.post("/day/tick", async (req,res)=>{
  const userId = String(req.body?.userId || "1");
  const dateKey = String(req.body?.dateKey || todayKey());

  const st = (await db.select().from(mblAvatarState).where(eq(mblAvatarState.userId, userId))).at(0);
  if (!st) return res.status(404).json({ error:"No state" });

  const d = (await db.select().from(mblDayLog)
    .where(and(eq(mblDayLog.userId, userId), eq(mblDayLog.dateKey, dateKey)))).at(0)
    || { nutritionScore:50, trainingScore:0, lifestyleScore:50, mealNames:[], workoutName:"" };

  const next: MblState = tickDay({
    weightLbs: Number(st.weightLbs), bodyFatPct: Number(st.bodyFatPct), muscleMassLbs: Number(st.muscleMassLbs),
    energy: Number(st.energy), mood: Number(st.mood), lifestyleScore: Number(st.lifestyleScore),
    visualStage: (st.visualStage as any) || "average"
  }, {
    nutritionScore: Number(d.nutritionScore), trainingScore: Number(d.trainingScore), lifestyleScore: Number(d.lifestyleScore)
  });

  await db.update(mblAvatarState).set({
    weightLbs: next.weightLbs.toString(), bodyFatPct: next.bodyFatPct.toString(), muscleMassLbs: next.muscleMassLbs.toString(),
    energy: next.energy.toString(), mood: next.mood.toString(), lifestyleScore: next.lifestyleScore.toString(),
    visualStage: next.visualStage, lastSimDate: dateKey
  }).where(eq(mblAvatarState.userId, userId));

  await db.update(mblDayLog).set({
    weightLbs: next.weightLbs.toString(), bodyFatPct: next.bodyFatPct.toString(), muscleMassLbs: next.muscleMassLbs.toString(),
    energy: next.energy.toString(), mood: next.mood.toString(), visualStage: next.visualStage
  }).where(and(eq(mblDayLog.userId, userId), eq(mblDayLog.dateKey, dateKey)));

  res.json({ state: next, dateKey });
});

r.get("/history", async (req,res)=>{
  const userId = String(req.query.userId || "1");
  const rows = await db.select().from(mblDayLog).where(eq(mblDayLog.userId, userId)).orderBy(asc(mblDayLog.dateKey));
  res.json({ days: rows });
});

r.post("/reset", async (req,res)=>{
  const userId = String(req.body?.userId || "1");
  await db.execute(/* sql */`delete from mbl_day_log where user_id='${userId}'`);
  await db.update(mblAvatarState).set({
    weightLbs: "185", bodyFatPct: "28", muscleMassLbs: "70", energy: "60", mood: "60", lifestyleScore: "60",
    visualStage: "average", lastSimDate: ""
  }).where(eq(mblAvatarState.userId, userId));
  res.json({ ok:true });
});

export default r;