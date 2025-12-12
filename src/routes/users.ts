import { Hono } from 'hono';
import { hash } from 'bcryptjs'; // Função para criptografar senha
import { zValidator } from '@hono/zod-validator'; // Middleware que conecta Hono + Zod
import { registerSchema } from '../validators/users';
import { users } from '../db/schema';
import { success, error } from '../utils/response';
import { Database } from '../db';
import { eq } from 'drizzle-orm';

// Criando uma sub-aplicação Hono só para usuários
// Isso permite que o 'app' principal saiba que 'db' existe nas variáveis
const app = new Hono<{ Variables: { db: Database } }>();

// Rota: POST /register
app.post(
  '/register', 
  // 1. Validação automática (se falhar, nem entra na função)
  zValidator('json', registerSchema), 
  
  async (c) => {
    const db = c.get('db');
    const data = c.req.valid('json'); // Dados já validados e tipados!

    try {
      // 2. Verificar se email já existe
      // A query retorna um array, pegamos o primeiro item
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, data.email)
      });

      if (existingUser) {
        return error(c, 'Este e-mail já está cadastrado.', null, 409);
      }

      // 3. Criptografar a senha (Hash)
      // O '10' é o custo do processamento (salt rounds)
      const passwordHash = await hash(data.password, 10);

      // 4. Salvar no Banco
      // O .returning() faz o D1 devolver os dados do usuário criado
      const [newUser] = await db.insert(users).values({
        name: data.name,
        email: data.email,
        password: passwordHash,
        walletAddress: data.walletAddress,
        role: 'user',
        // Campos de governança iniciam padrão (false/0)
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt
      });

      return success(c, newUser, 'Usuário criado com sucesso!', 201);

    } catch (err: any) {
      console.error(err);
      return error(c, 'Erro ao criar usuário', err.message, 500);
    }
  }
);

export default app;
