
import { ChatSpace } from '../types';

export async function fetchChatSpaces(accessToken: string): Promise<ChatSpace[]> {
  const response = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al obtener espacios de Chat');
  }

  const data = await response.json();
  return data.spaces || [];
}

export async function sendChatCard(
  accessToken: string, 
  spaceName: string, 
  title: string, 
  subtitle: string, 
  details: { label: string, value: string }[]
) {
  const card = {
    cardsV2: [{
      cardId: 'yield_report',
      card: {
        header: {
          title: '🚀 YieldMaster Report',
          subtitle: title,
          imageUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
          imageType: 'CIRCLE'
        },
        sections: [{
          header: subtitle,
          widgets: details.map(d => ({
            decoratedText: {
              topLabel: d.label,
              text: d.value,
              startIcon: { knownIcon: 'STAR' }
            }
          }))
        }]
      }
    }]
  };

  const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Error al enviar mensaje a Chat');
  }

  return await response.json();
}
