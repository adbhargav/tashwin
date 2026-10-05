import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
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
          {tree.slice(0, 4).map((dept) => (
            <Column key={dept.id} title={dept.name}>
              {dept.children.map((g) => <Item key={g.id} to={`/c/${g.slug}`}>{g.name}</Item>)}
            </Column>
          ))}
          <Column title="Help">
            <Item to="/support">Support</Item>
            <Item to="/account/orders">Track Your Order</Item>
            <Item to="/offers">Offers</Item>
            <Item to="/account">My Account</Item>
          </Column>
          <Column title="Contact">
            <li className="mb-3 flex gap-2"><Phone size={15} className="mt-0.5 shrink-0" />{SITE.phone}</li>
            <li className="mb-3 flex gap-2 break-all"><Mail size={15} className="mt-0.5 shrink-0" />{SITE.email}</li>
            <li className="mb-3 flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0" />{SITE.address}</li>
          </Column>
        </div>
        <div className="h-px bg-line" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-5">
          <img src="/logo.png" alt={SITE.name} className="h-10" />
          <p className="text-xs">© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
