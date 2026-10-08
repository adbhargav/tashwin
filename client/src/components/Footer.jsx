import { Link } from 'react-router-dom';
import { FileText, Mail, MapPin, Phone } from 'lucide-react';

// Brand marks are not in the icon library, so they are drawn inline.
const Instagram = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const Facebook = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />
  </svg>
);
import { useShop } from '../context/Shop';
import { SITE } from '../lib/site';

const Column = ({ title, children }) => (
  <div>
    <p className="text-base font-medium text-ink mb-4 leading-[19px]">{title}</p>
    <ul>{children}</ul>
  </div>
);
const Item = ({ to, children }) => (
  <li className="mb-3 leading-[21px]"><Link to={to} className="transition-colors duration-300 hover:text-ink">{children}</Link></li>
);

export default function Footer() {
  const { tree } = useShop();
  return (
    <footer className="bg-[#f6f6f6] pt-[43px] mt-16">
      <div className="max-w-[1200px] mx-auto px-[15px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div>
            <h4 className="text-lg font-medium text-ink leading-[22px] mb-2">Need help choosing?</h4>
            <p className="leading-[17px]">Talk to our furniture experts for home, office and bulk orders.</p>
          </div>
          <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="btn btn-dark self-start"><Phone size={16} />{SITE.phone}</a>
        </div>
        <div className="h-px bg-line" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-8 py-[34px]">
          {tree.slice(0, 3).map((dept) => (
            <Column key={dept.id} title={dept.name}>
              {dept.children.map((g) => <Item key={g.id} to={`/c/${g.slug}`}>{g.name}</Item>)}
            </Column>
          ))}
          <Column title="Help">
            <Item to="/support">Support</Item>
            <Item to="/account/orders">Track Your Order</Item>
            <Item to="/projects">Our Projects</Item>
            <Item to="/offers">Offers</Item>
            <Item to="/account">My Account</Item>
          </Column>
          <Column title="Policies">
            <Item to="/privacy-policy">Privacy Policy</Item>
            <Item to="/terms-and-conditions">Terms &amp; Conditions</Item>
            <Item to="/refund-policy">Refund Policy</Item>
          </Column>
          <Column title="Contact">
            <li className="mb-3 flex gap-2"><Phone size={15} className="mt-0.5 shrink-0" />{SITE.phone}</li>
            <li className="mb-3 flex gap-2 break-all"><Mail size={15} className="mt-0.5 shrink-0" />{SITE.email}</li>
            <li className="mb-3 flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0" />{SITE.address}</li>
            <li className="mb-3 flex gap-2"><FileText size={15} className="mt-0.5 shrink-0" />GSTIN: {SITE.gstin}</li>
          </Column>
        </div>
        <div className="h-px bg-line" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-5">
          <img src="/logo.png" alt={SITE.name} className="h-10" />
          <div className="flex items-center gap-2">
            <a href={SITE.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full border border-line flex items-center justify-center hover:border-ink hover:text-ink"><Instagram size={17} /></a>
            <a href={SITE.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full border border-line flex items-center justify-center hover:border-ink hover:text-ink"><Facebook size={17} /></a>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
