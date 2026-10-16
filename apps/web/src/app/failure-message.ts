import type { ApiFailure } from '../api/request';
import { es } from '../i18n/es';

export type FailureContext = 'default' | 'import';

/**
 * Plain Spanish for any failed call. After an import request, anything that leaves the outcome
 * unknown (no answer, a timeout, a cancelled wait, a server error) says so, because the API may
 * have created products before the answer was lost.
 */
export function failureMessage(failure: ApiFailure, context: FailureContext = 'default'): string {
  const importing = context === 'import';
  switch (failure.kind) {
    case 'api':
      if (failure.code !== null) return es.errors.api[failure.code];
      return importing && failure.status >= 500 ? es.errors.importUnknown : es.errors.unexpected;
    case 'network':
    case 'timeout':
    case 'aborted':
    case 'invalid_response':
      if (importing) return es.errors.importUnknown;
      return failure.kind === 'invalid_response'
        ? es.errors.invalidResponse
        : es.errors[failure.kind];
  }
}
