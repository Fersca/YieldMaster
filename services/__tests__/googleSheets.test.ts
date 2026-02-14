import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBalancesFromSheet,
  fetchBanksFromSheet,
  getOrCreateFolder,
  getOrCreateSpreadsheet,
  saveBalancesToSheet,
  saveBanksToSheet,
  uploadImageToDrive
} from '../googleSheets';

function jsonResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

describe('googleSheets service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetchBanksFromSheet maps rows and parses numbers', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        values: [
          ['ID', 'Name', 'Rate Pesos', 'Rate USD', 'Source', 'Last Updated'],
          ['1', 'Banco A', '35.5', '1.25', 'public', '2026-01-01']
        ]
      })
    );

    const result = await fetchBanksFromSheet('token', 'sheet-1');

    expect(result).toEqual([
      {
        id: '1',
        name: 'Banco A',
        ratePesos: 35.5,
        rateUsd: 1.25,
        source: 'public',
        lastUpdated: '2026-01-01'
      }
    ]);
  });

  it('fetchBanksFromSheet returns empty on status 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, false, 400, 'Bad request'));

    const result = await fetchBanksFromSheet('token', 'sheet-1');

    expect(result).toEqual([]);
  });

  it('fetchBanksFromSheet throws detailed error when request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { message: 'forbidden' } }, false, 403, 'Forbidden')
    );

    await expect(fetchBanksFromSheet('token', 'sheet-1')).rejects.toThrow(
      'Error leyendo Hoja de Bancos: 403 - forbidden'
    );
  });

  it('saveBanksToSheet sends values and auth header', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ updatedCells: 1 }));

    await saveBanksToSheet('token-abc', 'sheet-1', [
      { id: '1', name: 'Banco A', ratePesos: 30, rateUsd: 0.5, source: 'local', lastUpdated: 'x' }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('values/Bancos!A1:F2');
    expect(options.method).toBe('PUT');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer token-abc' });
  });

  it('fetchBalancesFromSheet parses and returns both balances', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ values: [['1000.5', '20']] }));

    const result = await fetchBalancesFromSheet('token', 'sheet-1');

    expect(result).toEqual({ pesos: 1000.5, usd: 20 });
  });

  it('fetchBalancesFromSheet returns null on status 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, false, 400, 'Bad request'));

    const result = await fetchBalancesFromSheet('token', 'sheet-1');

    expect(result).toBeNull();
  });

  it('saveBalancesToSheet throws with statusText when json parse fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server down',
      json: vi.fn().mockRejectedValue(new Error('invalid json'))
    } as unknown as Response);

    await expect(saveBalancesToSheet('token', 'sheet', 10, 20)).rejects.toThrow(
      'Error guardando Hoja de Saldos: 500 - Server down'
    );
  });

  it('getOrCreateSpreadsheet returns existing id when found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ files: [{ id: 'spreadsheet-1' }] }));

    const result = await getOrCreateSpreadsheet('token');

    expect(result).toBe('spreadsheet-1');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('getOrCreateSpreadsheet creates one when not found', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ spreadsheetId: 'new-sheet' }));

    const result = await getOrCreateSpreadsheet('token');

    expect(result).toBe('new-sheet');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getOrCreateFolder creates folder when absent', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'folder-1' }));

    const result = await getOrCreateFolder('token');

    expect(result).toBe('folder-1');
  });

  it('uploadImageToDrive posts multipart payload', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'file-1' }));

    await uploadImageToDrive('token', 'folder-1', 'YmFzZTY0', 'capture.jpg');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('uploadType=multipart');
    expect(options.method).toBe('POST');
    expect(String(options.body)).toContain('capture.jpg');
    expect(String(options.body)).toContain('YmFzZTY0');
  });
});
