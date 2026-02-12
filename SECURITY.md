
# 🔒 Guía de Seguridad - YieldMaster

Dado que YieldMaster es una aplicación del lado del cliente (Client-Side), la API Key de Gemini es técnicamente visible en el código fuente. Para evitar el uso no autorizado y proteger tu cuota/créditos, **debes aplicar restricciones** en la consola de Google Cloud.

## 1. Restricción por Sitio Web (HTTP Referrer)
Esto asegura que la clave solo funcione cuando las peticiones provengan de tu dominio.

1. Ve a [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2. Haz clic en tu API Key.
3. En **Set an application restriction**, selecciona **Websites**.
4. En **Website restrictions**, añade:
   - `http://localhost:5173/*` (Para desarrollo local)
   - `https://tu-dominio.com/*` (Para producción)

## 2. Restricción de API
Esto evita que la clave se use para otros servicios de Google.

1. En la misma pantalla, bajo **API restrictions**, selecciona **Restrict key**.
2. En el menú desplegable, selecciona únicamente: `Generative Language API`.
3. Guarda los cambios.

## 3. Manejo de Secretos en CI/CD
Si usas GitHub Actions para desplegar (ej. en Vercel o Netlify):
- **NO** subas el archivo `.env` al repositorio.
- Añade `VITE_GEMINI_API_KEY` como una **Secret Variable** en la configuración de tu proveedor de hosting.

---
*Nota: Estas restricciones son el estándar de la industria para aplicaciones web sin backend propio.*
