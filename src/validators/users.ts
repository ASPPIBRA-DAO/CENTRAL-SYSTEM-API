import { z } from 'zod';

// Schema para REGISTRO de novos usuários
export const registerSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Formato de email inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  
  // Opcionais para Web3 (podem vir nulos no cadastro inicial)
  walletAddress: z.string().startsWith("0x", "Endereço de carteira inválido").optional(),
});

// Schema para LOGIN
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Inferindo os tipos TypeScript a partir dos schemas (para usar no código)
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
