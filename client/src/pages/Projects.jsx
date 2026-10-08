import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, MapPin } from 'lucide-react';
import { api, asset } from '../lib/api';
import { useSeo } from '../lib/seo';
import { SITE } from '../lib/site';

const youtubeId = (url) => url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/)?.[1];

export function ProjectCard({ p, large }) {
  return (
    <Link to={`/projects/${p.slug}`} className="group block">
      <div className={`overflow-hidden rounded-xl bg-soft ${large ? 'aspect-[16/10]' : 'aspect-[3/2]'}`}>
        {p.cover_image && <img src={asset(p.cover_image)} alt={p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />}
      </div>
      <p className="mt-3.5 text-xs uppercase tracking-wider text-brand font-medium">{p.category}{p.location && <span className="text-mute font-normal normal-case tracking-normal"> · {p.location}</span>}</p>
      <h3 className={`text-ink mt-1 ${large ? 'text-2xl leading-8' : 'text-xl leading-7'}`}>{p.title}</h3>
      {p.summary && <p className="mt-1.5 line-clamp-2">{p.summary}</p>}
    </Link>
  );
}

export default function Projects() {
  useSeo({ title: 'Our Projects', description: `Offices, homes and showrooms furnished by ${SITE.name}. See our completed projects.` });
  const [projects, setProjects] = useState(null);
  const [type, setType] = useState('');
  useEffect(() => { api('/api/projects').then(setProjects).catch(() => setProjects([])); }, []);
  if (!projects) return <div className="min-h-[70vh]" />;
  const types = [...new Set(projects.map((p) => p.category))];
  const shown = type ? projects.filter((p) => p.category === type) : projects;
  const [first, ...rest] = shown;
  return (
    <div className="px-4 md:px-[50px] pb-16">
      <div className="text-center max-w-2xl mx-auto mt-10 mb-8">
        <h1 className="heading">Our Projects</h1>
        <p className="text-base mt-3">Offices, homes and showrooms we have furnished end to end — from the first measurement to the last chair in place.</p>
      </div>
      {types.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[['', 'All'], ...types.map((t) => [t, t])].map(([v, l]) => (
            <button key={v} onClick={() => setType(v)} className={`rounded-full px-4 py-2 text-sm border transition-colors ${type === v ? 'bg-ink text-white border-ink' : 'border-line hover:border-ink'}`}>{l}</button>
          ))}
        </div>
      )}
      {shown.length === 0 && <p className="text-center py-20 text-base">Project stories are on their way. Please check back soon.</p>}
      {first && (
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
          <div className="lg:col-span-2"><ProjectCard p={first} large /></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-8 content-start">{rest.slice(0, 2).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          {rest.slice(2).map((p) => <ProjectCard key={p.id} p={p} />)}
        </div>
      )}
      <div className="mt-16 bg-soft rounded-2xl p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div><p className="text-2xl text-ink">Planning an office or a full home?</p><p className="text-base mt-1">Talk to us about bulk pricing, custom sizes and installation.</p></div>
        <Link to="/support" className="btn btn-primary self-start md:self-auto">Discuss your project<ArrowRight size={18} /></Link>
      </div>
    </div>
  );
}

export function ProjectDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  useEffect(() => { setData(null); setError(''); setActive(null); api(`/api/projects/${slug}`).then(setData).catch((e) => setError(e.message)); }, [slug]);
  const p = data?.project;
  useSeo(error ? { title: 'Project not found', noindex: true } : p && {
    fullTitle: p.seo_title, title: `${p.title} — ${p.category} project${p.location ? ` in ${p.location}` : ''}`,
    description: p.seo_description || p.summary || p.description, image: p.cover_image || p.images[0], type: 'article',
  });
  if (error) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><p className="text-xl text-ink">{error}</p><Link to="/projects" className="btn btn-primary">All projects</Link></div>;
  if (!data) return <div className="min-h-[80vh]" />;
  const yt = youtubeId(p.video);
  const photos = p.images;
  const facts = [[Building2, 'Type', p.category], [MapPin, 'Location', p.location], [CalendarDays, 'Completed', p.completed_on]].filter(([, , v]) => v);
  return (
    <article className="pb-16">
      <div className="px-4 md:px-[50px]">
        <Link to="/projects" className="inline-flex items-center gap-1 mt-5 hover:text-brand"><ArrowLeft size={16} />All projects</Link>
        <div className="max-w-3xl mt-5 mb-8">
          <p className="text-xs uppercase tracking-wider text-brand font-medium">{p.category}{p.client && <span className="text-mute font-normal normal-case tracking-normal"> · for {p.client}</span>}</p>
          <h1 className="text-[32px] leading-10 md:text-[40px] md:leading-[48px] text-ink mt-2">{p.title}</h1>
          {p.summary && <p className="text-lg leading-7 mt-3">{p.summary}</p>}
        </div>
        {p.cover_image && <div className="overflow-hidden rounded-2xl bg-soft aspect-[21/9]"><img src={asset(p.cover_image)} alt={p.title} className="w-full h-full object-cover" /></div>}
        <div className="grid lg:grid-cols-3 gap-10 mt-10">
          <div className="lg:col-span-2 space-y-5 text-base leading-7">
            {p.description.split(/\n\s*\n/).filter(Boolean).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
            {p.video && (
              <div className="overflow-hidden rounded-xl bg-black aspect-video">
                {yt ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Project video" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  : <video src={asset(p.video)} controls playsInline className="w-full h-full" />}
              </div>
            )}
          </div>
          <aside className="space-y-5">
            {facts.length > 0 && (
              <div className="bg-soft rounded-xl p-5 space-y-4">
                {facts.map(([Icon, label, value]) => <div key={label} className="flex gap-3"><Icon size={20} strokeWidth={1.5} className="text-brand shrink-0 mt-0.5" /><div><p className="text-xs uppercase tracking-wider text-mute">{label}</p><p className="text-ink">{value}</p></div></div>)}
              </div>
            )}
            <div className="rounded-xl border border-line p-5">
              <p className="text-ink text-lg">Want something similar?</p>
              <p className="mt-1">We handle bulk orders, custom sizes and installation across Telangana and beyond.</p>
              <Link to="/support" className="btn btn-dark w-full mt-4">Talk to us</Link>
            </div>
          </aside>
        </div>
        {photos.length > 0 && (
          <section className="mt-12">
            <h2 className="heading !text-left mb-5">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((src, i) => (
                <button key={src + i} onClick={() => setActive(i)} className={`overflow-hidden rounded-xl bg-soft aspect-[3/2] ${i === 0 && photos.length > 2 ? 'col-span-2 row-span-2 md:aspect-auto' : ''}`}>
                  <img src={asset(src)} alt={`${p.title} photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </button>
              ))}
            </div>
          </section>
        )}
        {data.more.length > 0 && (
          <section className="mt-16">
            <h2 className="heading !text-left mb-6">More projects</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">{data.more.map((m) => <ProjectCard key={m.id} p={m} />)}</div>
          </section>
        )}
      </div>
      {active != null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setActive(null)} role="dialog" aria-modal="true">
          <img src={asset(photos[active])} alt="" className="max-w-full max-h-full object-contain" />
          {photos.length > 1 && <>
            <button onClick={(e) => { e.stopPropagation(); setActive((active + photos.length - 1) % photos.length); }} aria-label="Previous" className="absolute left-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30"><ArrowLeft size={20} /></button>
            <button onClick={(e) => { e.stopPropagation(); setActive((active + 1) % photos.length); }} aria-label="Next" className="absolute right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30"><ArrowRight size={20} /></button>
          </>}
          <p className="absolute bottom-5 text-white/70 text-sm">{active + 1} / {photos.length}</p>
        </div>
      )}
    </article>
  );
}
