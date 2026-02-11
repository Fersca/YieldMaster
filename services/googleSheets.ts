
import { Bank } from '../types';

const SPREADSHEET_NAME = "BankYield_Data";
const BANKS_SHEET = "Bancos";
const BALANCES_SHEET = "Saldos";

async function handleResponseError(response: Response, prefix: string) {
  let detail = "";
  try {
    const json = await response.json();
    detail = json.error?.message || JSON.stringify(json);
  } catch {
    detail = response.statusText;
  }
  throw new Error(`${prefix}: ${response.status} - ${detail}`);
}

export async function fetchBanksFromSheet(accessToken: string, spreadsheetId: string): Promise<Bank[]> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${BANKS_SHEET}!A:F`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    if (response.status === 400) return [];
    await handleResponseError(response, "Error leyendo Hoja de Bancos");
  }

  const data = await response.json();
  if (!data.values || data.values.length <= 1) return [];

  return data.values.slice(1).map((row: any[]) => ({
    id: row[0],
    name: row[1],
    ratePesos: parseFloat(row[2]) || 0,
    rateUsd: parseFloat(row[3]) || 0,
    source: (row[4] as 'public' | 'local') || 'local',
    lastUpdated: row[5] || undefined
  }));
}

export async function saveBanksToSheet(accessToken: string, spreadsheetId: string, banks: Bank[]) {
  const values = [
    ["ID", "Name", "Rate Pesos", "Rate USD", "Source", "Last Updated"],
    ...banks.map(b => [b.id, b.name, b.ratePesos.toString(), b.rateUsd.toString(), b.source || 'local', b.lastUpdated || ""])
  ];

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${BANKS_SHEET}!A1:F${values.length}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    await handleResponseError(response, "Error guardando Hoja de Bancos");
  }
}

export async function fetchBalancesFromSheet(accessToken: string, spreadsheetId: string): Promise<{pesos: number, usd: number} | null> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${BALANCES_SHEET}!A2:B2`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    if (response.status === 400) return null;
    await handleResponseError(response, "Error leyendo Hoja de Saldos");
  }

  const data = await response.json();
  if (!data.values || data.values.length === 0) return null;

  return {
    pesos: parseFloat(data.values[0][0]) || 0,
    usd: parseFloat(data.values[0][1]) || 0
  };
}

export async function saveBalancesToSheet(accessToken: string, spreadsheetId: string, pesos: number, usd: number) {
  const values = [
    ["Pesos", "USD"],
    [pesos.toString(), usd.toString()]
  ];

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${BALANCES_SHEET}!A1:B2?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    await handleResponseError(response, "Error guardando Hoja de Saldos");
  }
}

export async function getOrCreateSpreadsheet(accessToken: string): Promise<string> {
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_NAME}' and trashed=false`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!searchRes.ok) {
      await handleResponseError(searchRes, "Error buscando en Drive");
    }
    
    const searchData = await searchRes.json();
    let spreadsheetId = "";

    if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
    } else {
        const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: { title: SPREADSHEET_NAME },
                sheets: [
                  { properties: { title: BANKS_SHEET } },
                  { properties: { title: BALANCES_SHEET } }
                ]
            })
        });
        
        if (!createRes.ok) {
          await handleResponseError(createRes, "Error creando Hoja");
        }
        
        const createData = await createRes.json();
        spreadsheetId = createData.spreadsheetId;
        return spreadsheetId;
    }

    const checkSheetsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const sheetInfo = await checkSheetsRes.json();
    const existingTitles = sheetInfo.sheets.map((s: any) => s.properties.title);

    const adds = [];
    if (!existingTitles.includes(BANKS_SHEET)) adds.push({ addSheet: { properties: { title: BANKS_SHEET } } });
    if (!existingTitles.includes(BALANCES_SHEET)) adds.push({ addSheet: { properties: { title: BALANCES_SHEET } } });

    if (adds.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: adds })
      });
    }

    return spreadsheetId;
}
