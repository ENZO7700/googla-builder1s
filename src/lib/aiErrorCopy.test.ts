import { describe, expect, it } from 'vitest';
import {
  formatStreamingAiDiagnosticDetail,
  getAiErrorCopy,
  getAiErrorCopyFromError,
  resolveAiErrorKind,
} from '@/lib/aiErrorCopy';

describe('aiErrorCopy', () => {
  it('maps HTTP 402 to credit/gateway copy', () => {
    const copy = getAiErrorCopy({ status: 402 });
    expect(copy.kind).toBe('402');
    expect(copy.title).toContain('Nedostatok kreditov');
    expect(copy.action).toContain('MISTRAL_API_KEY');
  });

  it('maps AbortError to timeout', () => {
    expect(resolveAiErrorKind({ name: 'AbortError', message: 'The operation was aborted' })).toBe('timeout');
  });

  it('parses HTTP status from error message', () => {
    const copy = getAiErrorCopyFromError(new Error('HTTP 429 z AI Gateway'));
    expect(copy.kind).toBe('429');
  });

  it('formats Streaming AI diagnostic detail for 402', () => {
    expect(formatStreamingAiDiagnosticDetail(402)).toContain('402');
    expect(formatStreamingAiDiagnosticDetail(402)).toContain('kredit');
  });

  it('maps 401/5xx/network to expected kinds', () => {
    expect(getAiErrorCopy({ status: 401 }).kind).toBe('401');
    expect(getAiErrorCopy({ status: 503 }).kind).toBe('5xx');
    expect(getAiErrorCopy({ message: 'Failed to fetch' }).kind).toBe('network');
  });
});
