// Business details printed on emails and invoices.
export const SITE = {
  name: 'Tashwin Furniture',
  tagline: 'Born to Win',
  phone: '+91 99895 40243',
  email: 'tashwinfurniture@gmail.com',
  address: 'Plot No. 4, Meena Nagar Colony, Behind Bharat Electronics Limited, Industrial Development Area, Nacharam, Secunderabad, Telangana – 500076',
  gstin: '36DIHPP9200D1ZC',
  social: {
    instagram: 'https://www.instagram.com/tashwinfurniture',
    facebook: 'https://www.facebook.com/people/Tashwin-Furniture/61573106105198/',
  },
  url: (process.env.CLIENT_ORIGIN || 'http://localhost:5180').split(',')[0],
};
