import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSeo } from '../lib/seo';

// Renders the simple text format used in Admin > Policies: "## Heading", "- bullet", blank line = new paragraph.
export function SimpleText({ text }) {
  const blocks = String(text || '').split(/\n\s*\n/).filter(Boolean);
  const render = (lines, key) => {
    if (!lines.length) return null;
    if (lines.every((l) => l.startsWith('- '))) return <ul key={key} className="list-disc pl-5 space-y-1.5">{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
    return <p key={key} className="whitespace-pre-line">{lines.join('\n')}</p>;
  };
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    // A heading may be followed directly by its paragraph or bullets without a blank line.
    if (lines[0].startsWith('## ')) return [<h2 key={`h${i}`} className="text-xl text-ink font-medium mt-8 mb-2">{lines[0].slice(3)}</h2>, render(lines.slice(1), `b${i}`)];
    return render(lines, i);
  });
}

export default function Policy() {
  const { slug } = useParams();
  const [pages, setPages] = useState(null);
  useEffect(() => { api('/api/policies').then(setPages).catch(() => setPages([])); }, []);
  const page = pages?.find((p) => p.slug === slug);
  useSeo(pages && (page ? { title: page.title, description: `${page.title} of Tashwin Furniture.` } : { title: 'Page not found', noindex: true }));
  if (!pages) return <div className="min-h-[70vh]" />;
  if (!page) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><p className="text-xl text-ink">Page not found</p><Link to="/" className="btn btn-primary">Back to home</Link></div>;
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="heading !text-left">{page.title}</h1>
      <div className="mt-6 text-base leading-7 space-y-4">
        <SimpleText text={page.body} />
      </div>
      <div className="flex flex-wrap gap-4 mt-12 pt-6 border-t border-line text-sm">
        {pages.filter((p) => p.slug !== slug).map((p) => <Link key={p.slug} to={`/${p.slug}`} className="text-brand hover:underline">{p.title}</Link>)}
      </div>
    </div>
  );
}
