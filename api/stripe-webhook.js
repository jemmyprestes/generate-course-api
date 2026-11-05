import { PRODUCTS, HttpError, sandbox, rawBody, verifySignature, db, stripe, failure } from '../lib/billing.js';
export const config = { api: { bodyParser: false } };
const id = object => typeof object === 'string' ? object : object?.id;

async function orderFor(metadata) {
  if (!metadata?.order_id) return null;
  const rows = await db(`billing_orders?id=eq.${encodeURIComponent(metadata.order_id)}&select=*`);
  const order = rows[0];
  if (!order) return null; // unrelated Stripe integration
  if (order.user_id !== metadata.user_id || order.product !== metadata.product ||
      (order.course_id || '') !== (metadata.course_id || '')) throw new Error('Metadata mismatch');
  return order;
}

export async function fulfillCheckout(sessionId, event) {
  const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`);
  if (session.livemode !== false) throw new Error('Live checkout');
  const order = await orderFor(session.metadata);
  if (!order) return;
  const product = PRODUCTS[order.product];
  const lines = session.line_items;
  if (session.client_reference_id !== order.user_id || session.mode !== product.mode ||
      lines?.has_more || lines?.data?.length !== 1 || lines.data[0].price?.id !== product.price ||
      lines.data[0].quantity !== 1 || session.currency !== 'eur' || session.amount_total !== product.amount ||
      (order.session_id && order.session_id !== session.id)) throw new Error('Checkout mismatch');
  if (session.status !== 'complete' || session.payment_status !== 'paid') return;
  if (order.product === 'plus') {
    await syncSubscription(id(session.subscription), event);
    return;
  }
  await db('rpc/billing_fulfill_order', { p_order_id: order.id, p_session_id: session.id,
    p_event_id: event.id, p_payment_intent: id(session.payment_intent) });
}

export async function syncSubscription(subscriptionId, event) {
  if (!subscriptionId) return;
  const sub = await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=latest_invoice`);
  if (sub.livemode !== false) throw new Error('Live subscription');
  const order = await orderFor(sub.metadata);
  if (!order) return;
  if (order.product !== 'plus' || sub.items?.has_more || sub.items?.data?.length !== 1 ||
      sub.items.data[0].price?.id !== PRODUCTS.plus.price || sub.items.data[0].quantity !== 1) throw new Error('Subscription mismatch');
  const invoice = sub.latest_invoice;
  // Only an actually paid invoice extends access. An active status alone never does.
  let paidUntil = null;
  if (invoice?.status === 'paid' && invoice.currency === 'eur' &&
      invoice.amount_paid >= PRODUCTS.plus.amount && invoice.livemode === false) {
    const lines = await stripe(`invoices/${encodeURIComponent(invoice.id)}/lines?limit=100`);
    if (lines.has_more) throw new Error('Invoice pagination required');
    const line = lines.data.find(x => x.pricing?.price_details?.price === PRODUCTS.plus.price &&
      x.parent?.subscription_item_details?.subscription === sub.id && x.amount >= PRODUCTS.plus.amount);
    if (line?.period?.end) paidUntil = new Date(line.period.end * 1000).toISOString();
  }
  await db('rpc/billing_sync_subscription', { p_order_id: order.id, p_subscription_id: sub.id,
    p_status: sub.status, p_paid_until: paidUntil, p_event_id: event.id, p_event_created: event.created });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    sandbox();
    const raw = await rawBody(req);
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, 'Webhook não configurado.');
    verifySignature(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Evento inválido.'); }
    if (event.livemode !== false) throw new HttpError(400, 'Apenas eventos de teste.');
    if (!event.id || !Number.isInteger(event.created) || !event.data?.object) throw new HttpError(400, 'Evento inválido.');
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await fulfillCheckout(event.data.object.id, event);
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await syncSubscription(event.data.object.id, event);
    } else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
      await syncSubscription(id(event.data.object.parent?.subscription_details?.subscription), event);
    }
    return res.status(200).json({ received: true });
  } catch (error) { return failure(res, error); }
}
