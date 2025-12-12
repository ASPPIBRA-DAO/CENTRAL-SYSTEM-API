import { Hono } from 'hono';
import { success } from '../utils/response';
import { Database } from '../db';

// Mock post data
const mockPosts = [
  {
    id: '1',
    title: 'Post de Exemplo 1',
    content: 'Este é o conteúdo do primeiro post.',
    createdAt: new Date().toISOString(),
    category: 'Testing',
    coverUrl: '/assets/images/mock/cover/cover-1.webp',
    totalViews: 500,
    totalComments: 20,
    totalShares: 10,
    description: 'Um post inicial para testes',
    tags: ['teste', 'exemplo'],
    isPublished: true,
    comments: [],
    meta: { title: 'Post 1', description: 'Meta Desc 1'},
    author: { name: 'Admin', avatarUrl: '/assets/images/mock/avatar/avatar-1.webp'}
  },
  {
    id: '2',
    title: 'Outro Post Interessante',
    content: 'Aqui falamos sobre desenvolvimento com Hono e Cloudflare.',
    createdAt: new Date().toISOString(),
    category: 'Development',
    coverUrl: '/assets/images/mock/cover/cover-2.webp',
    totalViews: 1200,
    totalComments: 45,
    totalShares: 30,
    description: 'Um post sobre desenvolvimento web moderno',
    tags: ['hono', 'cloudflare', 'dev'],
    isPublished: true,
    comments: [],
    meta: { title: 'Post 2', description: 'Meta Desc 2'},
    author: { name: 'Developer', avatarUrl: '/assets/images/mock/avatar/avatar-2.webp'}
  },
];

const app = new Hono<{ Variables: { db: Database } }>();

// Rota: GET /api/post/list
app.get('/list', (c) => {
  return success(c, { posts: mockPosts }, 'Posts recuperados com sucesso!');
});

// Rota: GET /api/post/:title
app.get('/:title', (c) => {
  const title = c.req.param('title');
  const post = mockPosts.find(p => p.title === title);

  if (!post) {
    return c.json({ error: 'Post não encontrado' }, 404);
  }

  return success(c, { post }, 'Post recuperado com sucesso!');
});

export default app;
