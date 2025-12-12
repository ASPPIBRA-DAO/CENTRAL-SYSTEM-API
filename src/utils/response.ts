import { Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status';

// Formato padrão de sucesso
export const success = (c: Context, data: any, message: string = 'Success', status: StatusCode = 200) => {
  return c.json(
    {
      success: true,
      message,
      data,
    },
    status
  );
};

// Formato padrão de erro
export const error = (c: Context, message: string, errors: any = null, status: StatusCode = 400) => {
  return c.json(
    {
      success: false,
      message,
      errors, // Detalhes do erro (ex: validação do Zod falhou no campo 'email')
    },
    status
  );
};
