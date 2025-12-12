import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Governance API Worker', () => {
	describe('General Routes', () => {
		it('GET / returns HTML dashboard', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			const text = await response.text();
			expect(response.status).toBe(200);
			expect(text).toContain('<!DOCTYPE html>');
			expect(text).toContain('ASPPIBRA DAO');
		});

		it('GET /health-db returns status ok', async () => {
			// Mocking D1 if necessary or relying on integration environment
			// Note: In unit style with cloudflare:test, env.DB is mocked automatically by vitest-pool-workers
			const request = new Request('http://example.com/health-db');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Expect 200 OK
			expect(response.status).toBe(200);
			const json = await response.json() as any;
			expect(json.success).toBe(true);
			expect(json.data.status).toBe('ok');
		});
	});

    // TODO: Add more tests for Auth and Posts using mock DB or integration tests
});
