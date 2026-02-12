
import { Bank } from '../types';

const SPREADSHEET_NAME = "BankYield_Data";
const CAPTURES_FOLDER_NAME = "BankYield_Captures";
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
    
    if (!searchRes.ok) await handleResponseError(searchRes, "Error buscando en Drive");
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

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
    
    if (!createRes.ok) await handleResponseError(createRes, "Error creando Hoja");
    const createData = await createRes.json();
    return createData.spreadsheetId;
}

/** 
 * Drive Folder and File Management 
 */

export async function getOrCreateFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${CAPTURES_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) await handleResponseError(searchRes, "Error buscando carpeta en Drive");
  
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: CAPTURES_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) await handleResponseError(createRes, "Error creando carpeta");
  const createData = await createRes.json();
  return createData.id;
}

export async function uploadImageToDrive(accessToken: string, folderId: string, base64Data: string, fileName: string) {
  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'image/jpeg'
  };

  const multipartBody = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/jpeg\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    await handleResponseError(response, "Error subiendo imagen a Drive");
  }
  return await response.json();
}
