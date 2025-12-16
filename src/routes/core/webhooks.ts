import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', (c) => c.json({ module: 'Webhooks', received: true }));

export default app;