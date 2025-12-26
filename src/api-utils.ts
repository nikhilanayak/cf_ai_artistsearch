/**
 * Utility functions for making API calls with passcode authentication
 */

function getPasscode(): string | null {
  return sessionStorage.getItem("app_passcode");
}

export function getApiHeaders(): HeadersInit {
  const passcode = getPasscode();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (passcode) {
    headers["X-Passcode"] = passcode;
  }
  
  return headers;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const passcode = getPasscode();
  const headers = new Headers(options.headers);
  
  if (passcode) {
    headers.set("X-Passcode", passcode);
  }
  
  if (!headers.has("Content-Type") && (options.method === "POST" || options.method === "PUT" || options.method === "PATCH")) {
    headers.set("Content-Type", "application/json");
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

