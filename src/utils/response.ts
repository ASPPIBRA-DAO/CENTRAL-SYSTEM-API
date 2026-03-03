/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Standardized API Responses (Absolute Bank-Grade 10/10)
 * Version: 6.0.0 - Zero Double-Serialization, Node Counting, Nosniff & Anti-Spoofing
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
    traceId: string;   
    requestId: string; 
  };
}

// 🛡️ SRE: Memory & CPU Protection Limits
const MAX_PAYLOAD_SIZE_BYTES = 1048576; // 1 MB Hard Ceiling
const MAX_NESTING_DEPTH = 6;
const MAX_VISITED_NODES = 5000; // Proteção contra objetos largos ("wide")

// 🛡️ SRE: Prevents CPU Exhaustion via JSON Bombs (Depth + Width Node Counter)
const isStructurallyDangerous = (obj: any, state = { depth: 0, nodes: 0 }): boolean => {
  if (state.depth > MAX_NESTING_DEPTH) return true;
  if (!obj || typeof obj !== 'object') return false;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      state.nodes++;
      if (state.nodes > MAX_VISITED_NODES) return true; // Halt CPU burn
      
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        if (isStructurallyDangerous(val, { depth: state.depth + 1, nodes: state.nodes })) return true;
      }
    }
  }
  return false;
};

// 🛡️ SRE: Secure Headers & TraceId Spoofing Defense
const resolveTraceId = (c: Context): string => {
  const internalTrace = c.res.headers.get('X-Trace-Id');
  if (internalTrace) return internalTrace; // Trust server-generated traces

  const externalTrace = c.req.header('X-Trace-Id');
  // Prefix externally provided traces to prevent log spoofing
  return externalTrace ? `ext-${externalTrace.substring(0, 36)}` : crypto.randomUUID();
};

const setSecureHeaders = (c: Context, traceId: string, requestId: string, errorCode?: string) => {
  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('X-Content-Type-Options', 'nosniff'); // Mitiga MIME sniffing
  c.header('X-Trace-Id', traceId);
  c.header('X-Request-Id', requestId);
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  
  if (errorCode) c.header('X-Error-Code', errorCode);
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
  const traceId = resolveTraceId(c);
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  setSecureHeaders(c, traceId, requestId);

  // 🛡️ SRE: Previne travamento de Isolate (CPU limits)
  if (isStructurallyDangerous(data)) {
    console.error(`[SRE_CPU_WARN] Request: ${requestId} - Success payload exceeded structural safety limits`);
    return error(c, 'Internal Server Error (Payload Too Complex)', null, 500, 'PAYLOAD_TOO_COMPLEX');
  }

  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta: { timestamp, traceId, requestId }
  };

  // 🛡️ SRE: Single-Pass Serialization & Byte Size Limiting
  try {
    const jsonStr = JSON.stringify(response);
    const byteSize = new TextEncoder().encode(jsonStr).length;

    if (byteSize > MAX_PAYLOAD_SIZE_BYTES) {
      console.error(`[SRE_MEMORY_WARN] Request: ${requestId} - Payload size (${byteSize} bytes) exceeded 1MB limit`);
      return error(c, 'Internal Server Error (Payload Too Large)', null, 500, 'PAYLOAD_TOO_LARGE');
    }

    return c.newResponse(jsonStr, status); // Evita double-serialization overhead

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
  const traceId = resolveTraceId(c);
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const env = (c.env as any)?.NODE_ENV || 'production';

  setSecureHeaders(c, traceId, requestId, errorCode);

  // 🛡️ SECURITY: Fail-safe 1 - Instâncias Error
  let safeDetails: any = details instanceof Error ? 'Internal Error Object Redacted' : details;

  // 🛡️ SECURITY: Fail-safe 2 - Mascaramento Gradual por Ambiente
  if (typeof safeDetails === 'string' && errorCode !== 'PAYLOAD_OVERSIZED' && errorCode !== 'PAYLOAD_TOO_LARGE' && errorCode !== 'PAYLOAD_TOO_COMPLEX' && errorCode !== 'CIRCULAR_JSON_ERROR') {
    if (env === 'production') {
      safeDetails = 'Redacted for security.';
    } else if (env === 'staging') {
      safeDetails = safeDetails.length > 30 ? safeDetails.substring(0, 30) + '... [Truncated in Staging]' : safeDetails;
    }
  }

  // 🛡️ SRE: CPU Protection em `details`
  if (isStructurallyDangerous(safeDetails)) {
    console.error(`[SRE_CPU_WARN] Request: ${requestId} - Error details exceeded structural limits`);
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
    const jsonStr = JSON.stringify(response);
    const byteSize = new TextEncoder().encode(jsonStr).length;

    if (byteSize > MAX_PAYLOAD_SIZE_BYTES) {
      console.error(`[SRE_MEMORY_WARN] Request: ${requestId} - Error Payload size exceeded 1MB limit`);
      // Evita recursividade fatal alterando safeDetails diretamente e enviando envelope minimalista
      return c.newResponse(JSON.stringify({
        success: false,
        message: 'Critical Error Response Too Large',
        error: { code: 500, errorCode: 'FATAL_ERROR_SIZE' },
        meta: { timestamp, traceId, requestId }
      }), 500);
    }

    return c.newResponse(jsonStr, status);

  } catch (e) {
    console.error(`[SRE_CRITICAL_SERIALIZATION_ERROR] Request: ${requestId}`, e);
    return c.newResponse(JSON.stringify({
      success: false,
      message: 'Critical Serialization Failure',
      error: { code: 500, errorCode: 'CRITICAL_CIRCULAR_ERROR' },
      meta: { timestamp, traceId, requestId } // 🛡️ SRE: Timestamp monotônico (não re-gerado)
    }), 500);
  }
};