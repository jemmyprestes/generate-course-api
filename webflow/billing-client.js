// Uses the existing Supabase client; never stores or exposes server credentials.
// Wire into the actual Webflow UI only after inspecting that site's existing scripts.
export function createBillingClient({ supabase, apiBase }) {
  const base = new URL(apiBase);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new Error('API HTTPS obrigatória.');
  async function request(path, data) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Inicie sessão para continuar.');
    const response = await fetch(new URL(path, base), {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Pedido indisponível.'), { status: response.status });
    return result;
  }
  const pending = new Map();
  return {
    entitlements: () => request('/api/billing-entitlements'),
    certificateAccess: courseId => request('/api/certificate-access', { courseId }),
    async checkout(product, courseId) {
      // Reuse an attempt ID on network retries. Clear by creating a new client after returning.
      const key = `${product}:${courseId || ''}`;
      if (!pending.has(key)) pending.set(key, crypto.randomUUID());
      const result = await request('/api/create-checkout-session', { product, ...(courseId ? { courseId } : {}), requestId: pending.get(key) });
      const target = new URL(result.url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('Checkout inválido.');
      window.location.assign(target.href);
    }
  };
}
