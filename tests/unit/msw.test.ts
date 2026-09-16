import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import { errorOnce } from '../mocks/handlers';

const API = 'http://localhost:8080';

describe('MSW harness', () => {
  it('intercepts fetch against the default handlers', async () => {
    const res = await fetch(`${API}/credits/balance`);
    expect(res.ok).toBe(true);
    await expect(res.json()).resolves.toMatchObject({ balance: 1000 });
  });

  it('supports per-test error overrides', async () => {
    server.use(errorOnce('get', '/credits/balance', 401));

    const failed = await fetch(`${API}/credits/balance`);
    expect(failed.status).toBe(401);

    // the override was `once`, so the default handler is back
    const recovered = await fetch(`${API}/credits/balance`);
    expect(recovered.status).toBe(200);
  });

  it('resets overrides between tests', async () => {
    const res = await fetch(`${API}/credits/balance`);
    expect(res.status).toBe(200);
  });

  it('matches parameterised routes', async () => {
    const res = await fetch(`${API}/wallets/kwamis/abc-123`);
    expect(res.ok).toBe(true);
  });
});
