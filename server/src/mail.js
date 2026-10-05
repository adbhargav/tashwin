import nodemailer from 'nodemailer';
import { SITE } from './site.js';

const { EMAIL_USER, EMAIL_PASS } = process.env;
const transporter = EMAIL_USER && EMAIL_PASS
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS.replace(/\s/g, '') } })
  : null;
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
const LOGO = new URL('../../client/public/logo.png', import.meta.url).pathname;

const BRAND = '#f9761f';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const invoiceNo = (order) => `INV-${new Date(order.created_at).getFullYear()}-${String(order.id).padStart(5, '0')}`;

// Email never blocks or fails a request: errors are logged and swallowed.
function send(to, subject, body) {
  if (!transporter || !to) return Promise.resolve(false);
  return transporter.sendMail({
    from: `"${SITE.name}" <${EMAIL_USER}>`, to, subject, html: layout(subject, body),
    attachments: [{ filename: 'logo.png', path: LOGO, cid: 'logo' }],
  }).then(() => true).catch((e) => { console.error(`Email to ${to} failed:`, e.message); return false; });
}

const layout = (title, body) => `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
<tr><td align="center" style="padding:22px 24px 14px;border-bottom:3px solid ${BRAND};"><img src="cid:logo" alt="${esc(SITE.name)}" height="64" style="height:64px;"></td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:23px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:600;color:#222;">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 32px;background:#222;color:#bbb;font-size:12px;line-height:18px;" align="center">
${esc(SITE.name)} · ${esc(SITE.tagline)}<br>${esc(SITE.phone)} · ${esc(SITE.email)}<br>${esc(SITE.address)}
</td></tr></table></td></tr></table></body></html>`;

const button = (href, label) => `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:13px 28px;border-radius:50px;">${esc(label)}</a></p>`;

const itemsTable = (order) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0;">
<tr style="background:#f8f8f8;"><th align="left" style="padding:10px;">Item</th><th align="center" style="padding:10px;">Qty</th><th align="right" style="padding:10px;">Price</th><th align="right" style="padding:10px;">Amount</th></tr>
${order.items.map((i) => `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;"><strong>${esc(i.name)}</strong><br><span style="color:#707070;">${esc(i.subtitle)}</span></td>
<td align="center" style="padding:10px;">${i.qty}</td><td align="right" style="padding:10px;white-space:nowrap;">${inr(i.price)}</td><td align="right" style="padding:10px;white-space:nowrap;">${inr(i.price * i.qty)}</td></tr>`).join('')}
<tr><td colspan="3" align="right" style="padding:10px;">Delivery &amp; installation</td><td align="right" style="padding:10px;">Free</td></tr>
<tr><td colspan="3" align="right" style="padding:10px;font-size:16px;"><strong>Total (incl. of all taxes)</strong></td><td align="right" style="padding:10px;font-size:16px;white-space:nowrap;"><strong>${inr(order.total)}</strong></td></tr>
</table>`;

const addressBlock = (a) => `${esc(a.name)} · ${esc(a.phone)}<br>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}`;
const orderLink = (order) => `${SITE.url}/account/orders/${order.id}`;

// Standalone printable invoice (also opened from the order page and the admin panel).
export function invoiceHtml(order, email) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${invoiceNo(order)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#333;margin:0;background:#f6f6f6;}
  .sheet{max-width:800px;margin:24px auto;background:#fff;padding:40px;border-top:6px solid ${BRAND};}
  h1{font-size:30px;letter-spacing:3px;margin:0;color:#222;} table{width:100%;border-collapse:collapse;}
  .meta td{padding:3px 0;font-size:14px;} .muted{color:#707070;} .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:6px;}
  .paid{display:inline-block;border:2px solid #1a8f3c;color:#1a8f3c;font-weight:700;padding:4px 14px;border-radius:4px;letter-spacing:2px;transform:rotate(-4deg);}
  .print{display:block;margin:0 auto 24px;background:${BRAND};color:#fff;border:0;border-radius:50px;padding:12px 28px;font-size:15px;cursor:pointer;}
  @media print{body{background:#fff;}.sheet{margin:0;padding:24px;}.print{display:none;}}
</style></head><body><div class="sheet">
<table><tr><td><img src="${SITE.url}/logo.png" alt="${esc(SITE.name)}" style="height:80px;"></td>
<td align="right"><h1>INVOICE</h1><table class="meta" style="width:auto;margin-left:auto;margin-top:8px;">
<tr><td class="muted" style="padding-right:14px;">Invoice no.</td><td align="right"><strong>${invoiceNo(order)}</strong></td></tr>
<tr><td class="muted" style="padding-right:14px;">Order</td><td align="right">#${order.id}</td></tr>
<tr><td class="muted" style="padding-right:14px;">Date</td><td align="right">${date(order.created_at)}</td></tr></table></td></tr></table>
<table style="margin:32px 0 8px;font-size:14px;line-height:21px;"><tr valign="top">
<td width="50%"><div class="label">Sold by</div><strong>${esc(SITE.name)}</strong><br>${esc(SITE.address)}<br>${esc(SITE.phone)} · ${esc(SITE.email)}${SITE.gstin ? `<br>GSTIN: ${esc(SITE.gstin)}` : ''}</td>
<td width="50%"><div class="label">Billed &amp; shipped to</div>${addressBlock(order.address)}<br>${esc(email)}</td></tr></table>
${itemsTable(order)}
<table style="font-size:14px;margin-top:8px;"><tr valign="middle">
<td><div class="label">Payment</div>Razorpay${order.razorpay_payment_id ? ` · ${esc(order.razorpay_payment_id)}` : ''}</td>
<td align="right">${order.payment_status === 'paid' ? '<span class="paid">PAID</span>' : ''}</td></tr></table>
<p class="muted" style="font-size:12px;line-height:18px;margin-top:36px;border-top:1px solid #eee;padding-top:16px;">Prices are inclusive of all applicable taxes. Goods are covered by the manufacturer warranty stated on the product page.
This is a computer-generated invoice and does not require a signature. Thank you for choosing ${esc(SITE.name)}.</p>
</div><button class="print" onclick="window.print()">Print / Save as PDF</button></body></html>`;
}

const STATUS_COPY = {
  confirmed: ['Your order is confirmed', 'We have confirmed your order and are getting it ready.'],
  packed: ['Your order is packed', 'Your order has been packed and is ready to leave our warehouse. We will email you again as soon as it ships.'],
  shipped: ['Your order is on the way', 'Good news — your order has been shipped and is on its way to you.'],
  delivered: ['Your order has been delivered', 'Your order has been delivered. We hope you love it! If anything is not right, just reply to this email.'],
  cancelled: ['Your order has been cancelled', 'Your order has been cancelled. If you have paid, the refund will be processed to your original payment method.'],
  pending: ['Your order is pending', 'Your order is currently pending.'],
};

export const mail = {
  welcome: (user) => send(user.email, `Welcome to ${SITE.name}`,
    `<p>Hi ${esc(user.name || 'there')},</p><p>Thank you for creating an account with ${esc(SITE.name)}. You can now save your favourites, check out faster and track every order from your account.</p>${button(SITE.url, 'Start Shopping')}`),

  orderConfirmed: (order, email) => send(email, `Order #${order.id} confirmed — thank you!`,
    `<p>Hi ${esc(order.address.name)},</p><p>We have received your payment and your order is confirmed. Here is your invoice <strong>${invoiceNo(order)}</strong>.</p>
     ${itemsTable(order)}<p style="margin:0 0 4px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Delivering to</p><p style="margin:0;">${addressBlock(order.address)}</p>
     ${button(orderLink(order), 'Track Order & Download Invoice')}`),

  orderIncomplete: (order, email) => send(email, `Complete your order #${order.id}`,
    `<p>Hi ${esc(order.address.name)},</p><p>You were so close! Your order is saved but the payment was not completed. Your items are waiting — finish the payment to confirm them.</p>
     ${itemsTable(order)}${button(orderLink(order), 'Complete Payment')}<p style="color:#707070;font-size:13px;">If you have already paid or changed your mind, you can ignore this email.</p>`),

  orderStatus: (order, email) => {
    const [subject, text] = STATUS_COPY[order.status];
    return send(email, `${subject} — order #${order.id}`,
      `<p>Hi ${esc(order.address.name)},</p><p>${text}</p>${itemsTable(order)}${button(orderLink(order), 'View Order')}`);
  },

  adminNewOrder: (order, email) => send(adminEmails.join(','), `New paid order #${order.id} — ${inr(order.total)}`,
    `<p>A new order has been paid for by <strong>${esc(email)}</strong>.</p>${itemsTable(order)}<p>${addressBlock(order.address)}</p>${button(`${SITE.url}/admin/orders`, 'Open Orders')}`),

  adminIncompleteOrder: (order, email) => send(adminEmails.join(','), `Incomplete order #${order.id} — ${inr(order.total)}`,
    `<p><strong>${esc(email)}</strong> started an order but did not complete the payment. A reminder email has been sent to them.</p>${itemsTable(order)}<p>${addressBlock(order.address)}</p>${button(`${SITE.url}/admin/orders`, 'Open Orders')}`),
};
