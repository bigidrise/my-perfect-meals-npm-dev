/**
 * AI Health Metrics Service
 * 
 * Tracks success/fallback/error rates for AI generation routes.
 * This is the "are we lying?" detector - it exposes when the system
 * is returning fallbacks instead of real AI generation.
 * 
 * SUCCESS CLASSIFICATION (agreed taxonomy):
 * - Primary success: 'ai', 'cache' - Real AI generation or cached AI result
 * - Degraded (allowed): 'template' - Template-based, doesn't count against gate
 * - Fallback (counts against gate): 'catalog', 'fallback', 'error'
 */

export type GenerationSource = 'ai' | 'template' | 'fallback' | 'cache' | 'catalog' | 'error';

export interface GenerationEvent {
  timestamp: number;
  route: string;
  source: GenerationSource;
  durationMs: number;
  errorCode?: string;
}

interface RouteMetrics {
  primarySuccessCount: number;
  templateCount: number;
  fallbackCount: number;
  cacheCount: number;
  errorCount: number;
  totalDurationMs: number;
  requestCount: number;
}

const WINDOW_SIZE_MS = 15 * 60 * 1000; // 15 minutes
const MAX_EVENTS = 1000;

const events: GenerationEvent[] = [];
const routeMetrics: Map<string, RouteMetrics> = new Map();

export function recordGeneration(
  route: string,
  source: GenerationSource,
  durationMs: number,
  errorCode?: string
): void {
  const event: GenerationEvent = {
    timestamp: Date.now(),
    route,
    source,
    durationMs,
    errorCode,
  };

  events.push(event);
  
  // Trim old events
  const cutoff = Date.now() - WINDOW_SIZE_MS;
  while (events.length > 0 && events[0].timestamp < cutoff) {
    events.shift();
  }
  while (events.length > MAX_EVENTS) {
    events.shift();
  }

  // Update route metrics
  let metrics = routeMetrics.get(route);
  if (!metrics) {
    metrics = {
      primarySuccessCount: 0,
      templateCount: 0,
      fallbackCount: 0,
      cacheCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      requestCount: 0,
    };
    routeMetrics.set(route, metrics);
  }

  metrics.requestCount++;
  metrics.totalDurationMs += durationMs;

  switch (source) {
    case 'ai':
      metrics.primarySuccessCount++;
      break;
    case 'template':
      metrics.templateCount++;
      break;
    case 'fallback':
    case 'catalog':
      metrics.fallbackCount++;
      break;
    case 'cache':
      metrics.cacheCount++;
      break;
    case 'error':
      metrics.errorCount++;
      break;
  }
}

export function getRecentMetrics(route?: string): {
  status: 'ok' | 'degraded' | 'down';
  windowMs: number;
  routes: Record<string, {
    primarySuccessCount: number;
    templateCount: number;
    fallbackCount: number;
    cacheCount: number;
    errorCount: number;
    avgLatencyMs: number;
    fallbackRate: number;
  }>;
} {
  const cutoff = Date.now() - WINDOW_SIZE_MS;
  const recentEvents = events.filter(e => e.timestamp >= cutoff);
  
  const routeStats: Record<string, {
    primarySuccessCount: number;
    templateCount: number;
    fallbackCount: number;
    cacheCount: number;
    errorCount: number;
    avgLatencyMs: number;
    fallbackRate: number;
  }> = {};

  // Group by route
  const byRoute = new Map<string, GenerationEvent[]>();
  for (const event of recentEvents) {
    if (route && event.route !== route) continue;
    
    if (!byRoute.has(event.route)) {
      byRoute.set(event.route, []);
    }
    byRoute.get(event.route)!.push(event);
  }

  let totalFallbacks = 0;
  let totalRequests = 0;
  let hasErrors = false;

  for (const routeName of Array.from(byRoute.keys())) {
    const routeEvents = byRoute.get(routeName)!;
    let primary = 0, template = 0, fallback = 0, cache = 0, error = 0;
    let totalDuration = 0;

    for (const e of routeEvents) {
      totalDuration += e.durationMs;
      switch (e.source) {
        case 'ai': primary++; break;
        case 'template': template++; break;
        case 'fallback': 
        case 'catalog': fallback++; break;
        case 'cache': cache++; break;
        case 'error': error++; hasErrors = true; break;
      }
    }

    const total = routeEvents.length;
    // Fallback rate = (fallback + error) / total
    // Template is degraded but allowed, doesn't count against gate
    const fallbackRate = total > 0 ? (fallback + error) / total : 0;

    routeStats[routeName] = {
      primarySuccessCount: primary,
      templateCount: template,
      fallbackCount: fallback,
      cacheCount: cache,
      errorCount: error,
      avgLatencyMs: total > 0 ? Math.round(totalDuration / total) : 0,
      fallbackRate: Math.round(fallbackRate * 100) / 100,
    };

    // Only fallback + error count against release gate (not template)
    totalFallbacks += fallback + error;
    totalRequests += total;
  }

  // Determine overall status
  let status: 'ok' | 'degraded' | 'down' = 'ok';
  const overallFallbackRate = totalRequests > 0 ? totalFallbacks / totalRequests : 0;
  
  if (hasErrors || overallFallbackRate > 0.5) {
    status = 'down';
  } else if (overallFallbackRate > 0.05) {
    status = 'degraded';
  }

  return {
    status,
    windowMs: WINDOW_SIZE_MS,
    routes: routeStats,
  };
}

export function resetMetrics(): void {
  events.length = 0;
  routeMetrics.clear();
}
