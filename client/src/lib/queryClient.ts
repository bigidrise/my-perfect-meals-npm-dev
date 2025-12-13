import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "./resolveApiBase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;

    try {
      const data = await res.clone().json();
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
      else message = JSON.stringify(data);
    } catch {
      try {
        const text = await res.clone().text();
        if (text && !text.startsWith("<")) message = text;
      } catch {
      }
    }

    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<any> {
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
  
  const res = await fetch(fullUrl, {
    method,
    headers: fetchHeaders,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error(`API route intercepted by Vite middleware. Expected JSON but got HTML from ${url}`);
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const relativeUrl = queryKey.join("/") as string;
    const fullUrl = apiUrl(relativeUrl);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 2,
      throwOnError: false,
    },
    mutations: {
      retry: 2,
      throwOnError: false,
    },
  },
});