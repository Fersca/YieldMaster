import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMaturityReminder } from '../googleCalendar';

describe('googleCalendar service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates reminder event in ARS with expected payload', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'event-1' })
    } as unknown as Response);

    const result = await createMaturityReminder('token', 'Banco Uno', 1234, 'ARS', '2026-02-20');

    expect(result).toEqual({ id: 'event-1' });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(String(options.body)).toContain('Banco Uno');
    expect(String(options.body)).toContain('$ 1,234');
  });

  it('throws api message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: { message: 'calendar denied' } })
    } as unknown as Response);

    await expect(createMaturityReminder('token', 'Banco', 1, 'USD', '2026-02-20')).rejects.toThrow(
      'calendar denied'
    );
  });
});
