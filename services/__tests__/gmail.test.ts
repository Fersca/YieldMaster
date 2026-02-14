import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBankEmails } from '../gmail';

function response(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

describe('gmail service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns empty array when bank list is empty', async () => {
    const result = await fetchBankEmails('token', []);

    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('throws when Gmail search request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}, false));

    await expect(fetchBankEmails('token', ['Santander'])).rejects.toThrow('Error al buscar correos en Gmail');
  });

  it('returns empty array when no messages were found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({}));

    const result = await fetchBankEmails('token', ['Santander']);

    expect(result).toEqual([]);
  });

  it('maps message details and decodes payload body', async () => {
    const encoded = btoa('Promo especial');

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response({ messages: [{ id: 'm1' }] }))
      .mockResolvedValueOnce(
        response({
          id: 'm1',
          threadId: 't1',
          snippet: 'snippet text',
          payload: {
            headers: [
              { name: 'Subject', value: 'Descuento' },
              { name: 'From', value: 'Banco' },
              { name: 'Date', value: 'Fri, 14 Feb 2025 10:00:00 GMT' }
            ],
            parts: [{ mimeType: 'text/plain', body: { data: encoded } }]
          }
        })
      );

    const result = await fetchBankEmails('token', ['Banco']);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('Descuento');
    expect(result[0].from).toBe('Banco');
    expect(result[0].body).toBe('Promo especial');
  });

  it('falls back to snippet when body is absent', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response({ messages: [{ id: 'm1' }] }))
      .mockResolvedValueOnce(
        response({
          id: 'm1',
          threadId: 't1',
          snippet: 'snippet text',
          payload: {
            headers: [],
            body: {}
          }
        })
      );

    const result = await fetchBankEmails('token', ['Banco']);

    expect(result[0].subject).toBe('(Sin asunto)');
    expect(result[0].from).toBe('Desconocido');
    expect(result[0].body).toBe('snippet text');
  });
});
