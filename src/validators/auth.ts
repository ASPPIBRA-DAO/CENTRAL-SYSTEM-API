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
 * Role: Central System API & Identity Provider
 */
import { z } from 'zod';

// --- Schema para REGISTRO (Sign-Up) ---
// Sincronizado com os campos firstName e lastName do banco
export const signUpSchema = z.object({
  firstName: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  lastName: z.string().min(2, "O sobrenome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Formato de email inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  
  // Web3 opcional (mantido conforme sua versão anterior)
  walletAddress: z.string().startsWith("0x", "Endereço de carteira inválido").optional(),
});

// --- Schema para LOGIN (Sign-In) ---
export const loginSchema = z.object({
  email: z.string().email("Digite um email válido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

// --- [NOVO] Schema para ESQUECI MINHA SENHA ---
export const forgotPasswordSchema = z.object({
  email: z.string().email("Digite um email válido"),
});

// --- [NOVO] Schema para DEFINIR NOVA SENHA (Reset) ---
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token de recuperação é obrigatório"),
  password: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
});

// --- Inferindo os tipos TypeScript ---
export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;