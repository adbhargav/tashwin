import { api } from './api';
import { SITE } from './site';

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = resolve;
  s.onerror = () => reject(new Error('Could not load the payment window. Check your connection and try again.'));
  document.body.appendChild(s);
});

// Opens Razorpay for an order. Resolves true once the payment is verified by the server,
// false if the shopper closes the window without paying.
export async function payForOrder({ orderId, razorpay }, { name, email, phone }) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    new window.Razorpay({
      key: razorpay.keyId, order_id: razorpay.orderId, amount: razorpay.amount, currency: 'INR',
      name: SITE.name, description: `Order #${orderId}`, image: '/logo.png',
      prefill: { name, email, contact: phone },
      theme: { color: '#f9761f' },
      handler: (payment) => api(`/api/orders/${orderId}/verify`, { method: 'POST', body: payment }).then(() => resolve(true), reject),
      modal: { ondismiss: () => resolve(false) },
    }).open();
  });
}

// Invoices are served to signed-in users only, so fetch the HTML and open it in a new tab.
export async function openInvoice(path) {
  const tab = window.open('', '_blank');
  try {
    const { html } = await api(path);
    tab.document.write(html);
    tab.document.close();
  } catch (e) {
    tab?.close();
    throw e;
  }
}
