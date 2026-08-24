'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { TicketValidationResult } from '@/enums/ticket-validation-result.enum';
import type {
  TicketDisplay,
  ValidateTicketErrorBody,
  ValidateTicketResponse,
} from '@/types/ticket';

export interface TicketValidationOutcome {
  result: TicketValidationResult;
  message: string;
  ticket: TicketDisplay | null;
}

function parseErrorBody(raw: string): ValidateTicketErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'result' in parsed &&
      'message' in parsed
    ) {
      return parsed as ValidateTicketErrorBody;
    }
  } catch {
    // corpo não era JSON — segue com null, tratado como falha inesperada.
  }
  return null;
}

// TAREFA 3 (Sprint 4): INVALIDO/JA_USADO/EVENTO_ERRADO são 3 dos 4 retornos
// esperados de POST /tickets/validate (400/409/422, ver
// backend/src/modules/tickets/tickets.service.ts#validate), não falhas
// inesperadas — por isso viram um resultado tipado normal (`result`) em vez
// de erro de mutation. Só corpo de erro não reconhecível (rede, 500) segue
// como erro de verdade.
export function useTicketValidation(sessionId: string) {
  const { accessToken } = useAuth();

  return useMutation<TicketValidationOutcome, unknown, string>({
    mutationFn: async (token: string) => {
      try {
        const response = await apiClient.post<ValidateTicketResponse>(
          '/tickets/validate',
          { token, sessionId },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        return {
          result: response.result,
          message: 'Ingresso válido.',
          ticket: response.ticket,
        };
      } catch (error) {
        if (error instanceof ApiError) {
          const body = parseErrorBody(error.message);
          if (body) {
            return { result: body.result, message: body.message, ticket: null };
          }
        }
        throw error;
      }
    },
  });
}
