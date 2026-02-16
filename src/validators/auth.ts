/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Validators (Zod Schemas)
 * Version: 1.1.0 - Strict Sanitization & Password Complexity
 */

import { z } from 'zod';

/**
 * Regex para Complexidade de Senha:
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos um número ou caractere especial
 */
const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>0-9]).{8,}$/;
const passwordMessage = "A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula e um número ou símbolo.";

/**
 * Regex para Wallet EVM (Ethereum/BSC):
 * - Deve começar com 0x
 * - Seguido por 40 caracteres hexadecimais (total 42)
 */
const walletRegex = /^0x[a-fA-F0-9]{40}$/;

// --- [REGISTRO (Sign-Up)] ---
export const signUpSchema = z.object({
  firstName: z.string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres"),
    
  lastName: z.string()
    .trim()
    .min(2, "O sobrenome deve ter pelo menos 2 caracteres"),
    
  email: z.string()
    .trim()
    .toLowerCase() // Normaliza para evitar duplicatas (Ex: Sandro@ e sandro@)
    .email("Formato de email inválido"),
    
  password: z.string()
    .min(8, passwordMessage)
    .regex(passwordRegex, passwordMessage),
  
  walletAddress: z.string()
    .regex(walletRegex, "Endereço de carteira Web3 inválido (deve ser 42 caracteres hex)")
    .optional()
    .or(z.literal("")), // Permite campo vazio se opcional
});

// --- [LOGIN (Sign-In)] ---
export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email("Digite um email válido"),
    
  password: z.string()
    .min(1, "A senha é obrigatória"),
});

// --- [ESQUECI MINHA SENHA] ---
export const forgotPasswordSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email("Digite um email válido"),
});

// --- [DEFINIR NOVA SENHA (Reset)] ---
export const resetPasswordSchema = z.object({
  token: z.string()
    .min(1, "Token de recuperação é obrigatório"),
    
  password: z.string()
    .min(8, passwordMessage)
    .regex(passwordRegex, passwordMessage),
    
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// --- [INFERÊNCIA DE TIPOS] ---
export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;