
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn("Este navegador no soporta notificaciones de escritorio");
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.error("Error solicitando permisos de notificación:", e);
      return false;
    }
  }

  return false;
}

export function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    try {
      const defaultOptions: NotificationOptions = {
        icon: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
        ...options
      };
      
      // Envolviendo en try/catch porque algunos navegadores bloquean el constructor 
      // si no es disparado directamente por un evento de usuario o en ciertos contextos.
      new Notification(title, defaultOptions);
    } catch (error) {
      console.warn("No se pudo enviar la notificación:", error);
    }
  }
}
