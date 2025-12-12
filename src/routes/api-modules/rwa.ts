import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => c.json({ module: 'RWA', status: 'active' }));

export default app;