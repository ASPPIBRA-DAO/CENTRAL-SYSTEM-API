/**
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 * Service: Cryptography & JWT Management
 */
import { hash, compare } from 'bcryptjs';
import { sign } from 'hono/jwt';

/**
 * Gera o Hash da senha de forma segura para o Edge.
 * O custo (salt rounds) 10 é o padrão recomendado para o Cloudflare Workers.
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 10);
}

/**
 * Compara a senha enviada pelo usuário com o Hash armazenado no D1.
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (!password || !storedHash) return false;
    return await compare(password, storedHash);
  } catch (err) {
    console.error('Erro na comparação de hash:', err);
    return false;
  }
}

/**
 * Gera o JWT Access Token para autenticação.
 * Sincronizado com a expectativa do Frontend (AuthContext/Provider).
 */
export async function generateToken(user: any, secret: string): Promise<string> {
  if (!secret) {
    throw new Error('JWT_SECRET não configurado nas variáveis de ambiente');
  }

  const payload = {
    id: user.id,            // ID do banco D1
    email: user.email,
    role: user.role || 'citizen',
    // Expiração: 7 dias (conforme política institucional ASPPIBRA)
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
    iat: Math.floor(Date.now() / 1000),
  };

  return await sign(payload, secret);
}