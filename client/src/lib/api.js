const BASE = import.meta.env.VITE_API_URL || '';

let getToken = async () => null;
export const setTokenGetter = (fn) => { getToken = fn; };

export async function api(path, { method = 'GET', body, form } = {}) {
  const token = await getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
    body: form || (body && JSON.stringify(body)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// Uploaded images are stored as /uploads/... paths served by the API.
export const asset = (url) => (url?.startsWith('/uploads') ? BASE + url : url || '');
export const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
