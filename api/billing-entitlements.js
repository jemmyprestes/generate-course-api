import { cors, failure, user, db, sandbox } from '../lib/billing.js';
export default async function handler(req, res) {
  if (cors(req, res, 'GET')) return;
  try {
    sandbox();
    const account = await user(req);
    return res.status(200).json(await db('rpc/billing_entitlements', { p_user_id: account.id }));
  } catch (error) { return failure(res, error); }
}
