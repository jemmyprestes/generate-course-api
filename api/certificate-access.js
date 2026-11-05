import { cors, body, failure, user, ownedCourse, db, sandbox, HttpError } from '../lib/billing.js';
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    sandbox();
    const account = await user(req);
    const { courseId } = body(req);
    await ownedCourse(account.id, courseId);
    const allowed = await db('rpc/billing_certificate_access', { p_user_id: account.id, p_course_id: courseId });
    if (!allowed) throw new HttpError(402, 'É necessário adquirir o certificado e concluir a avaliação.');
    return res.status(200).json({ allowed: true, courseId });
  } catch (error) { return failure(res, error); }
}
