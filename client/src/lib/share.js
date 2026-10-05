import { useState } from 'react';

// Native share sheet on phones; copies the product link everywhere else.
// Returns [share, copied] where `copied` is true for two seconds after a copy.
export function useShare(p) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/product/${p.slug}`;
    try {
      if (navigator.share) return await navigator.share({ title: p.name, text: `${p.name} — ${p.subtitle}`, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* share sheet dismissed */ }
  }
  return [share, copied];
}
