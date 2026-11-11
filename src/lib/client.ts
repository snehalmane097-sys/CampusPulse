"use client";
export async function api<T = any>(url: string, method = "GET", data?: any): Promise<T> {
  const res = await fetch(url, { method, credentials: "same-origin", cache: "no-store", ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) });
  const result = await res.json().catch(() => ({ error: "The server returned an invalid response." }));
  if (res.status === 401) { localStorage.removeItem("cp_token"); localStorage.removeItem("cp_user"); window.location.assign("/"); }
  if (!res.ok) throw new Error(result.error || "Could not complete the request.");
  return result;
}
