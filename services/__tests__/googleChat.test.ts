import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchChatSpaces, sendChatCard } from '../googleChat';

describe('googleChat service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetchChatSpaces returns spaces from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ spaces: [{ name: 'spaces/1', displayName: 'General', type: 'SPACE' }] })
    } as unknown as Response);

    const result = await fetchChatSpaces('token');

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('General');
  });

  it('fetchChatSpaces throws api message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: { message: 'chat denied' } })
    } as unknown as Response);

    await expect(fetchChatSpaces('token')).rejects.toThrow('chat denied');
  });

  it('sendChatCard posts a message and returns API payload', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: 'messages/1' })
    } as unknown as Response);

    const result = await sendChatCard('token', 'spaces/123', 'Title', 'Subtitle', [
      { label: 'Rate', value: '35%' }
    ]);

    expect(result).toEqual({ name: 'messages/1' });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('spaces/123/messages');
    expect(String(options.body)).toContain('YieldMaster Report');
    expect(String(options.body)).toContain('35%');
  });

  it('sendChatCard throws fallback error message when API has none', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({})
    } as unknown as Response);

    await expect(sendChatCard('token', 'spaces/123', 'Title', 'Subtitle', [])).rejects.toThrow(
      'Error al enviar mensaje a Chat'
    );
  });
});
