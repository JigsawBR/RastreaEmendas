export const API_BASE_URL = "/api";

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

