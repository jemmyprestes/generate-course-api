import { randomUUID } from 'node:crypto';
import { PRODUCTS, UUID, HttpError, sandbox, cors, body, failure, user, ownedCourse, db, stripe } from '../lib/billing.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    sandbox();
    const account = await user(req);
    const { product, courseId, requestId } = body(req);
    if (!Object.hasOwn(PRODUCTS, product)) throw new HttpError(400, 'Produto inválido.');
    if (!UUID.test(requestId || '')) throw new HttpError(400, 'requestId UUID obrigatório.');
    if (product === 'certificate') await ownedCourse(account.id, courseId);
    else if (courseId !== undefined) throw new HttpError(400, 'courseId apenas para certificados.');
    const item = PRODUCTS[product];
    const price = await stripe(`prices/${item.price}`);
    if (price.livemode !== false || !price.active || price.currency !== 'eur' || price.unit_amount !== item.amount ||
      (product === 'plus' ? price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1 : price.type !== 'one_time')) {
      throw new HttpError(503, 'O preço não corresponde ao catálogo de teste.');
    }
    // The database fixes the purchase identity before contacting Stripe. Retries reuse it.
    const order = await db('rpc/billing_create_order', { p_id: randomUUID(), p_user_id: account.id,
      p_request_id: requestId, p_product: product, p_course_id: courseId || null });
    const metadata = { order_id: order.id, user_id: account.id, product, course_id: courseId || '' };
    const params = { mode: item.mode, 'line_items[0][price]': item.price, 'line_items[0][quantity]': '1',
      client_reference_id: account.id, 'payment_method_types[0]': 'card',
      success_url: 'https://e-learn-landing.webflow.io/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://e-learn-landing.webflow.io/?checkout=cancelled' };
    for (const [key, value] of Object.entries(metadata)) {
      params[`metadata[${key}]`] = value;
      if (product === 'plus') params[`subscription_data[metadata][${key}]`] = value;
    }
    const session = await stripe('checkout/sessions', params, `elearn-sandbox-${order.id}`);
    if (session.livemode !== false || !session.url?.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid session');
    await db('rpc/billing_attach_session', { p_order_id: order.id, p_session_id: session.id });
    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) { return failure(res, error); }
}
