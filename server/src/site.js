// Business details printed on emails and invoices. TODO: replace the placeholders with the client's real details.
export const SITE = {
  name: 'Tashwin Furniture',
  tagline: 'Born to Win',
  phone: '+91 00000 00000',
  email: process.env.EMAIL_USER || 'hello@tashwinfurniture.com',
  address: 'Showroom address goes here',
  gstin: '', // printed on the invoice when set
  url: (process.env.CLIENT_ORIGIN || 'http://localhost:5180').split(',')[0],
};
