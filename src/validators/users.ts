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
