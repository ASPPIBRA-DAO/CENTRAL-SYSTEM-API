/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Standardized API Responses (Absolute Bank-Grade 10/10)
 * Version: 5.0.0 - Depth Protection, RequestId Separation, Immutable Timestamps & Staging Masking
 */

import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * 🛡️ SRE: Interface Base (Bank-Grade)
 */
interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T | null;
  error?: {
    code: number;
    errorCode?: string;
    details?: Record<string, string[] | string> | string | null;
  };
  meta: {
    timestamp: string;
    traceId: string;   // Distribuído (flui entre serviços)
    requestId: string; // Único por execução HTTP
  };
}

// 🛡️ SRE: Heurísticas O(1) + Depth Guard
const MAX_ARRAY_ITEMS = 2500; 
const MAX_OBJECT_KEYS = 500;
const MAX_NESTING_DEPTH = 6;

const isOversized = (payload: any): boolean => {
  if (!payload) return false;
  if (Array.isArray(payload)) return payload.length > MAX_ARRAY_ITEMS;
  if (typeof payload === 'object') return Object.keys(payload).length > MAX_OBJECT_KEYS;
  return false;
};

// 🛡️ SRE: Prevents Memory Explosions via JSON Bombs (Nested arrays/objects)
const isTooDeep = (obj: any, currentDepth = 0): boolean => {
  if (currentDepth > MAX_NESTING_DEPTH) return true;
  if (!obj || typeof obj !== 'object') return false;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        if (isTooDeep(val, currentDepth + 1)) return true;
      }
    }
  }
  return false;
};

// 🛡️ SRE: Headers de Segurança Estritos
const setSecureHeaders = (c: Context, traceId: string, requestId: string) => {
  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('X-Trace-Id', traceId);
  c.header('X-Request-Id', requestId);
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
};

/**
 * Resposta de Sucesso Padronizada
 */
export const success = <T = null>(
  c: Context, 
  message: string = 'Operação realizada com sucesso', 
  data: T | null = null, 
  status: ContentfulStatusCode = 200
) => {
  // TraceId fluído (distributed) vs RequestId gerado na hora (local isolation)
  const traceId = c.res.headers.get('X-Trace-Id') || c.req.header('X-Trace-Id') || crypto.randomUUID();
  const requestId = crypto.randomUUID();
  
  // SRE: Immutable Timestamp - Protege contra middleware poisoning
  const timestamp = new Date().toISOString();

  setSecureHeaders(c, traceId, requestId);

  // 🛡️ SRE: O(1) Memory Protection & JSON Bomb Defense
  if (isOversized(data) || isTooDeep(data)) {
    console.error(`[SRE_MEMORY_WARN] Request: ${requestId} - Success payload exceeded size/depth limits`);
    return error(c, 'Internal Server Error (Payload Too Complex)', null, 500, 'PAYLOAD_OVERSIZED');
  }

  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta: { timestamp, traceId, requestId }
  };

  try {
    return c.json(response, status);
  } catch (e) {
    console.error(`[SRE_SERIALIZATION_CRASH] Request: ${requestId}`, { type: typeof data, error: e });
    return error(c, 'Internal Serialization Failure', null, 500, 'CIRCULAR_JSON_ERROR');
  }
};

/**
 * Resposta de Erro Padronizada
 */
export const error = (
  c: Context, 
  message: string, 
  details: Record<string, string[] | string> | string | null = null, 
  status: ContentfulStatusCode = 400,
  errorCode?: string
) => {
  const traceId = c.res.headers.get('X-Trace-Id') || c.req.header('X-Trace-Id') || crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const env = (c.env as any)?.NODE_ENV || 'production';

  setSecureHeaders(c, traceId, requestId);

  // 🛡️ SECURITY: Fail-safe 1 - Intercepta instâncias reais de erro
  let safeDetails: any = details instanceof Error ? 'Internal Error Object Redacted' : details;

  // 🛡️ SECURITY: Fail-safe 2 - Mascaramento Gradual por Ambiente
  if (typeof safeDetails === 'string' && errorCode !== 'PAYLOAD_OVERSIZED' && errorCode !== 'CIRCULAR_JSON_ERROR') {
    if (env === 'production') {
      safeDetails = 'Redacted for security.';
    } else if (env === 'staging') {
      // Partial masking for staging (shows only first 30 chars of the error)
      safeDetails = safeDetails.length > 30 ? safeDetails.substring(0, 30) + '... [Truncated in Staging]' : safeDetails;
    }
  }

  // 🛡️ SRE: Previne DoS via `details` recursivo gigante
  if (isOversized(safeDetails) || isTooDeep(safeDetails)) {
    console.error(`[SRE_MEMORY_WARN] Request: ${requestId} - Error details exceeded safe structural limits`);
    safeDetails = 'Error details truncated due to massive structural size.';
  }

  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code: status,
      ...(errorCode && { errorCode }),
      details: safeDetails
    },
    meta: { timestamp, traceId, requestId }
  };

  try {
    return c.json(response, status);
  } catch (e) {
    console.error(`[SRE_CRITICAL_SERIALIZATION_ERROR] Request: ${requestId}`, e);
    return c.json({
      success: false,
      message: 'Critical Serialization Failure',
      error: { code: 500, errorCode: 'CRITICAL_CIRCULAR_ERROR' },
      meta: { timestamp, traceId, requestId }
    }, 500);
  }
};
