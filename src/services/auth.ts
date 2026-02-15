/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 * Service: Cryptography & JWT Management
 * Version: 1.2.0 - Strict Typing & Sync with Middleware
 */
import { hash, compare } from 'bcryptjs';
import { sign } from 'hono/jwt';

/**
 * Interface de Identidade.
 * Garante que o gerador de tokens receba apenas dados validados pelo Schema.
 */
interface UserPayload {
  id: number;
  email: string;
  role: 'citizen' | 'partner' | 'admin' | 'system';
}

/**
 * Gera o Hash da senha utilizando bcryptjs.
 * DESIGN NOTE: bcryptjs é utilizado em vez do bcrypt nativo para garantir 
 * compatibilidade total com o runtime do Cloudflare Workers (V8 Edge).
 * @param password Senha em texto plano
 * @returns Hash criptografado (Salt cost 10)
 */
export async function hashPassword(password: string): Promise<string> {
  // Salt rounds em 10 equilibra segurança e tempo de execução no Edge
  return await hash(password, 10);
}

/**
 * Compara a senha enviada pelo usuário com o Hash armazenado no D1.
 * @param password Senha enviada no login
 * @param storedHash Hash recuperado do banco de dados
 * @returns Booleano confirmando a integridade das credenciais
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Fail-fast: evita processamento se os dados forem nulos
    if (!password || !storedHash) return false;
    return await compare(password, storedHash);
  } catch (err) {
    /**
     * Registro de erro interno sem expor detalhes sensíveis para o cliente.
     * Crucial para auditoria forense.
     */
    console.error('Auth Service: Erro na comparação de hash:', err);
    return false;
  }
}

/**
 * Gera o JWT Access Token para autenticação.
 * Sincronizado com o 'requireAuth' middleware e o Frontend (AuthContext).
 * @param user Objeto de usuário tipado (Rigoroso)
 * @param secret Chave mestra vinda das variáveis de ambiente
 * @returns Token JWT assinado com algoritmo HS256
 */
export async function generateToken(user: UserPayload, secret: string): Promise<string> {
  if (!secret) {
    throw new Error('CONFIG_ERROR: JWT_SECRET não localizado no ambiente.');
  }

  /**
   * PAYLOAD: Estrutura baseada no padrão RFC 7519.
   * iat: Issued At (Momento da criação)
   * exp: Expiration (Válido por 7 dias conforme política da ASPPIBRA)
   */
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    // Expiração institucional: 7 dias
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000), // Not Before (Token válido imediatamente)
  };

  /**
   * Assinatura do Token.
   * 🟢 SINCRONIA: Definido explicitamente como HS256 para bater com o middleware.
   */
  return await sign(payload, secret, 'HS256');
}