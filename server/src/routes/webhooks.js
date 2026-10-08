import { Router, raw } from 'express';
import crypto from 'node:crypto';
import { one } from '../db.js';
import { confirmPaid } from './user.js';

// Razorpay calls this after a payment, so an order is confirmed even when the shopper closed the page
// before the browser could report the payment. Set the same secret in the Razorpay dashboard (Webhooks)
// and in RAZORPAY_WEBHOOK_SECRET; subscribe to "payment.captured" and "order.paid".
const r = Router();
const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// The signature covers the exact bytes Razorpay sent, so this route reads the raw body instead of parsed JSON.
r.post('/razorpay', raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!secret) return res.status(503).json({ error: 'Webhook secret is not configured' });
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  const given = Buffer.from(String(req.headers['x-razorpay-signature'] || ''));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid payload' }); }

  const payment = event.payload?.payment?.entity;
  if (!['payment.captured', 'order.paid'].includes(event.event) || !payment?.order_id) return res.json({ ok: true, ignored: event.event });
  const order = await one(`SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.razorpay_order_id = $1`, [payment.order_id]);
  if (!order) return res.json({ ok: true, ignored: 'unknown order' });
  // confirmPaid only acts on orders not yet marked paid, so Razorpay's retries and the browser's own
  // confirmation cannot double-count stock or send duplicate emails.
  await confirmPaid(order, payment.id, order.email);
  res.json({ ok: true, orderId: order.id });
});

export default r;
