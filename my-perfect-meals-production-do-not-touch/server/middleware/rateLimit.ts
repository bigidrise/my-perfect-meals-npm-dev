import rateLimit from "express-rate-limit";

// Create rate limiter function that can be called AFTER app sets trust proxy
export function createApiRateLimit() {
  return rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_MAX ?? 300), // 300 writes per minute (generous)
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for development environment
      if (process.env.NODE_ENV === "development") return true;
      
      // ONLY rate limit writes (POST/PUT/PATCH/DELETE), never GET requests
      const isReadOnly = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
      return isReadOnly;
    },
  });
}