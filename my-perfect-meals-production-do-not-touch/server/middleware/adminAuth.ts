// server/middleware/adminAuth.ts
// Super-light admin auth for QA dashboard; replace with your real auth in prod.
export function requireAdmin(req: any, res: any, next: any) {
  const hdr = String(req.headers["x-admin-key"] || "");
  const key = process.env.ADMIN_KEY || "";
  
  if (!key) { 
    return res.status(403).json({ error: "ADMIN_KEY not set" }); 
  }
  
  if (hdr !== key) { 
    return res.status(401).json({ error: "Unauthorized" }); 
  }
  
  next();
}