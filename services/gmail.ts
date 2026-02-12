
import { BankEmail } from '../types';

export async function fetchBankEmails(accessToken: string, bankNames: string[]): Promise<BankEmail[]> {
  if (bankNames.length === 0) return [];

  // Construir consulta: correos de bancos específicos (por nombre en el remitente o asunto)
  const query = bankNames.map(name => `"${name}"`).join(' OR ');
  const encodedQuery = encodeURIComponent(query);

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=15`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Error al buscar correos en Gmail');

  const data = await response.json();
  if (!data.messages) return [];

  const emailPromises = data.messages.map(async (msg: { id: string }) => {
    const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const detail = await detailRes.json();
    
    const headers = detail.payload.headers;
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(Sin asunto)';
    const from = headers.find((h: any) => h.name === 'From')?.value || 'Desconocido';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    // Intentar extraer el cuerpo del mensaje
    let body = "";
    if (detail.payload.parts) {
      const part = detail.payload.parts.find((p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html');
      if (part && part.body && part.body.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (detail.payload.body && detail.payload.body.data) {
      body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    return {
      id: detail.id,
      threadId: detail.threadId,
      subject,
      from,
      date: new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      snippet: detail.snippet,
      body: body || detail.snippet
    };
  });

  return Promise.all(emailPromises);
}
