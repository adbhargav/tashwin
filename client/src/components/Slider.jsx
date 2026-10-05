import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Horizontal scroll-snap row with round prev/next buttons. `itemClass` sets each slide's width.
export default function Slider({ children, itemClass = 'w-[78%] sm:w-1/2 lg:w-1/4' }) {
  const ref = useRef(null);
  const move = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: 'smooth' });
  const arrow = 'hidden md:flex absolute top-[38%] z-10 w-10 h-10 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform hover:scale-110';
  return (
    <div className="relative">
      <button aria-label="Previous" onClick={() => move(-1)} className={`${arrow} -left-3`}><ChevronLeft size={20} /></button>
      <div ref={ref} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {[].concat(children).map((child, i) => <div key={i} className={`shrink-0 snap-start ${itemClass}`}>{child}</div>)}
      </div>
      <button aria-label="Next" onClick={() => move(1)} className={`${arrow} -right-3`}><ChevronRight size={20} /></button>
    </div>
  );
}
