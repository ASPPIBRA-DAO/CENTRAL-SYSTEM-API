/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 * Utility: Standardized API Responses (Strict Type-Safe Edition)
 * Version: 1.1.0
 */

import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Interface Base para Respostas da API
 * Define a estrutura comum para todos os retornos do sistema.
 */
interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

/**
 * Resposta de Sucesso Padronizada (Type-Safe)
 * Utiliza Generics <T> para garantir que o tipo do dado retornado seja preservado.
 * * @param c - Contexto do Hono (acesso a env e request)
 * @param message - Mensagem descritiva da operação
 * @param data - Carga útil da resposta (Objeto, Array, etc.)
 * @param status - Código HTTP de sucesso (Default: 200)
 */
export const success = <T>(
  c: Context, 
  message: string = 'Operação realizada com sucesso', 
  data: T = null as T, 
  status: ContentfulStatusCode = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  return c.json(response, status);
};

/**
 * Resposta de Erro Padronizada
 * Estrutura uniforme para falhas de validação, autenticação ou erros internos.
 * * @param c - Contexto do Hono
 * @param message - Título do erro para exibição ao usuário
 * @param errors - Detalhamento técnico ou array de erros de validação (Zod)
 * @param status - Código HTTP de erro (Default: 400)
 */
export const error = (
  c: Context, 
  message: string, 
  errors: any = null, 
  status: ContentfulStatusCode = 400
) => {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };

  return c.json(response, status);
};