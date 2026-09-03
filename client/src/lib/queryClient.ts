import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "./resolveApiBase";
import { pushFailedRequest } from "./diagnosticsBuffer";
import { inferProfessionalLegalAction } from "./professionalLegalRecovery";

async function throwIfResNotOk(res: Response, meta?: { method?: string; startedAt?: number }) {
  if (!res.ok) {
    // Record in the diagnostics buffer before throwing.
    // 401/403 are noted but not suppressed — they're valid diagnostic signal.
    const duration = meta?.startedAt != null ? Date.now() - meta.startedAt : undefined;
    const method   = (meta?.method ?? "GET").toUpperCase();
    try {
      const url = new URL(res.url);
      pushFailedRequest(method, url.pathname + url.search, res.status, duration);
    } catch {
      pushFailedRequest(method, res.url, res.status, duration);
    }

    let message = res.statusText;
    let code: string | undefined;
    let legalFlow: string | undefined;

    try {
      const data = await res.clone().json();
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
      else message = JSON.stringify(data);
      code = data?.code;
      legalFlow = data?.flow;
    } catch {
      try {
        const text = await res.clone().text();
        if (text && !text.startsWith("<")) message = text;
      } catch {
      }
    }

    // If the server enforced an idle timeout, signal the IdleTimeoutModal to
    // sign the user out cleanly rather than leaving the app in a broken state.
    if (res.status === 401 && code === "SESSION_IDLE_TIMEOUT") {
      window.dispatchEvent(new CustomEvent("mpm:session-idle-timeout"));
    }

    // If the server rejected a request due to a plan gate, the user's subscription
    // has likely been downgraded since their client-side state was last fetched.
    // Signal AuthContext to refresh the user profile so ProActionLock and other
    // plan-aware UI reflect the current tier immediately — no logout required.
    const PLAN_GATE_CODES = new Set([
      "PRO_REQUIRED",
      "PREMIUM_REQUIRED",
      "CLINICAL_REQUIRED",
      "CLINICAL_LABS_REQUIRED",
      "ESSENTIAL_REQUIRED",
    ]);
    if (res.status === 403 && code && PLAN_GATE_CODES.has(code)) {
      window.dispatchEvent(new CustomEvent("mpm:plan-downgraded"));
    }

    // ProCare Studio-specific gate: dispatch a dedicated event so the Studio guard
    // can surface a clear "trial ended — upgrade" prompt rather than a blank error.
    if (res.status === 403 && code === "PRO_REQUIRED") {
      window.dispatchEvent(new CustomEvent("mpm:pro-required"));
    }

    if (
      (res.status === 403 || res.status === 409) &&
      code === "LEGAL_REACCEPT_REQUIRED" &&
      (legalFlow === "professional" || legalFlow === "physician")
    ) {
      const returnTo = window.location.pathname + window.location.search;
      window.dispatchEvent(new CustomEvent("mpm:professional-legal-required", {
        detail: {
          returnTo,
          action: inferProfessionalLegalAction(res.url, method),
        },
      }));
    }

    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const { method = "GET", body, headers = {} } = options || {};
  
  const authToken = localStorage.getItem("mpm_auth_token");
  
  const fullUrl = apiUrl(url);
  
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (authToken) {
    fetchHeaders["x-auth-token"] = authToken;
  }

  const startedAt = Date.now();
  const res = await fetch(fullUrl, {
    method,
    headers: fetchHeaders,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res, { method, startedAt });
  
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error(`API route intercepted by Vite middleware. Expected JSON but got HTML from ${url}`);
  }
  
  return res.json() as Promise<T>;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const relativeUrl = queryKey.join("/") as string;
    const fullUrl = apiUrl(relativeUrl);
    
    const headers: Record<string, string> = {};
    const token = localStorage.getItem("mpm_auth_token");
    if (token) {
      headers["x-auth-token"] = token;
    }

    const res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Never retry auth errors — they are definitive failures, not transient ones.
  if (error instanceof Error) {
    const status = parseInt(error.message.split(":")[0], 10);
    if (status === 401 || status === 403) return false;
  }
  return failureCount < 2;
}

// Cold-start retry delay: give the server time to wake up before retrying.
// First retry waits 2s, second retry waits 5s. This prevents immediate
// error screens when the production server is waking up from idle.
function retryDelay(failureCount: number): number {
  return failureCount === 0 ? 2_000 : 5_000;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: shouldRetry,
      retryDelay,
      throwOnError: false,
    },
    mutations: {
      retry: (failureCount, error) => shouldRetry(failureCount, error),
      retryDelay,
      throwOnError: false,
    },
  },
});