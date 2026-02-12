
export async function createMaturityReminder(
  accessToken: string, 
  bankName: string, 
  amount: number, 
  currency: string, 
  expiryDate: string
) {
  const event = {
    summary: `💰 Vencimiento YieldMaster: ${bankName}`,
    description: `Recordatorio de vencimiento de inversión.\n\nMonto estimado: ${currency === 'ARS' ? '$' : 'u$s'} ${amount.toLocaleString()}\nBanco: ${bankName}\n\nGenerado por YieldMaster.`,
    start: {
      date: expiryDate, // Formato YYYY-MM-DD
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    end: {
      date: expiryDate,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 1440 },
      ],
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al crear evento en el calendario');
  }

  return await response.json();
}
