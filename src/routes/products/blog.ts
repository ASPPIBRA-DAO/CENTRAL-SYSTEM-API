/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Blog & SocialFi API
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { desc, eq, sql } from 'drizzle-orm';
import { posts, users } from '../../db/schema';
import { requireAuth } from '../../middleware/auth';
import { Database } from '../../db';

// Zod Schema para validação da criação de um post
const createPostSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  content: z.string().min(10, "O conteúdo deve ter pelo menos 10 caracteres."),
  slug: z.string().regex(/^[a-z0-9-]+$/, "O slug deve conter apenas letras minúsculas, números e hífens."),
  category: z.string().optional().default('Geral'),
  coverUrl: z.string().url("URL da imagem de capa inválida.").optional(),
  tags: z.string().optional(), // JSON string ou separado por vírgula
  published: z.boolean().optional().default(true),
});

// Definição do tipo de App para o Hono
type AppType = {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
  };
  Variables: {
    db: Database;
    user: { userId: number; role: string };
  };
};

const blog = new Hono<AppType>();

// =================================================================
// 1. ROTAS PÚBLICAS (LEITURA)
// =================================================================

/**
 * Rota: GET /api/posts
 * Retorna uma lista paginada de posts publicados.
 */
blog.get('/', async (c) => {
  const db = c.get('db');
  
  try {
    const publishedPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        category: posts.category,    // [NOVO] Importante para o filtro do Front
        coverUrl: posts.coverUrl,
        totalViews: posts.totalViews, // [NOVO] Para mostrar métricas
        published: posts.published,
        createdAt: posts.createdAt,
        author: {
          id: users.id,
          name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      // ✅ CORREÇÃO: Mudado de 'isPublished' para 'published' (nome real da coluna)
      .where(eq(posts.published, true)) 
      .orderBy(desc(posts.createdAt))
      .limit(20); // Aumentei o limite padrão

    return c.json({ success: true, data: publishedPosts });
  } catch (error) {
    console.error("Erro ao buscar posts:", error);
    return c.json({ success: false, message: 'Não foi possível recuperar os posts.' }, 500);
  }
});

/**
 * Rota: GET /api/posts/:slug
 * Retorna um post específico pelo seu slug.
 */
blog.get('/:slug', async (c) => {
    const db = c.get('db');
    const slug = c.req.param('slug');

    try {
        const [post] = await db
            .select({
                id: posts.id,
                title: posts.title,
                content: posts.content,
                slug: posts.slug,
                category: posts.category,
                tags: posts.tags,
                coverUrl: posts.coverUrl,
                totalViews: posts.totalViews,
                published: posts.published,
                createdAt: posts.createdAt,
                author: {
                    id: users.id,
                    name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
                },
            })
            .from(posts)
            .leftJoin(users, eq(posts.authorId, users.id))
            .where(eq(posts.slug, slug));
        
        if (!post) {
            return c.json({ success: false, message: 'Post não encontrado' }, 404);
        }

        return c.json({ success: true, data: post });

    } catch (error) {
        console.error(`Erro ao buscar o post [${slug}]:`, error);
        return c.json({ success: false, message: 'Não foi possível recuperar o post.' }, 500);
    }
});


// =================================================================
// 2. ROTAS PRIVADAS (ESCRITA)
// =================================================================

// Aplica o middleware de autenticação para todas as rotas de escrita abaixo
blog.use('/*', requireAuth());

/**
 * Rota: POST /api/posts
 * Cria um novo post no blog. Requer autenticação.
 */
blog.post('/', zValidator('json', createPostSchema), async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const postData = c.req.valid('json');

  try {
    const [newPost] = await db.insert(posts).values({
      ...postData,
      authorId: user.userId,
      // O campo createdAt é preenchido automaticamente pelo banco
    }).returning();

    return c.json({ success: true, data: newPost }, 201);
  } catch (error: any) {
    // Verifica erro de constraint (slug duplicado)
    if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('posts.slug')) {
        return c.json({ success: false, message: 'Este slug já está em uso. Por favor, escolha outro.' }, 409);
    }
    console.error("Erro ao criar post:", error);
    return c.json({ success: false, message: 'Não foi possível criar o post. Verifique os dados.' }, 500);
  }
});

export default blog;