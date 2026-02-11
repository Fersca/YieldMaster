
# 🚀 YieldMaster - Gestor de Rendimientos Bancarios

YieldMaster es una aplicación móvil-first diseñada para usuarios en Argentina que desean optimizar sus ahorros comparando tasas de interés (TNA) de diferentes bancos en tiempo real, utilizando Inteligencia Artificial para el escaneo de saldos y Google Sheets como base de datos persistente.

## ✨ Características Principales

- **🛡️ Autenticación con Google**: Los datos se guardan de forma segura en tu propio Google Drive.
- **📊 Persistencia en Google Sheets**: Funciona como un CMS/Base de datos. Si modificas el Excel, la app se actualiza.
- **👁️ OCR con Gemini 1.5 Flash**: Escanea tu saldo directamente de la pantalla del homebanking o de un ticket usando la cámara y visión artificial.
- **📈 Proyecciones Comparativas**: Visualiza en un gráfico interactivo cuánto ganarías en 12 meses comparando tu banco actual vs. otras opciones.
- **🌍 Tasas Públicas en Vivo**: Un agente de IA busca en internet las tasas actuales de los principales bancos argentinos y te sugiere actualizarlas.
- **📄 Reportes PDF**: Genera un reporte profesional con tus saldos, tabla de bancos y gráfico de crecimiento.

## 🛠️ Tecnologías

- **Frontend**: React 19 + TypeScript + Tailwind CSS.
- **IA/OCR**: Google Gemini SDK (`@google/genai`).
- **Gráficos**: Recharts.
- **Cloud**: Google Sheets API & Google Drive API.
- **Reportes**: jsPDF + html2canvas.

## 🚀 Configuración Local

1.  **Clonar y configurar**:
    ```bash
    git clone https://github.com/TU_USUARIO/TU_REPO.git
    cd yield-master-demo
    npm install
    ```

2.  **Variables de Entorno**:
    Crea un archivo `.env` en la raíz con tu API Key de Gemini:
    ```env
    VITE_GEMINI_API_KEY=tu_api_key_aqui
    ```

3.  **Google Cloud Console**:
    - Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
    - Habilita las APIs de **Google Sheets** y **Google Drive**.
    - Crea un **OAuth 2.0 Client ID** para aplicaciones web.
    - Agrega `http://localhost:5173` a los orígenes autorizados.
    - Pega el Client ID en la configuración de la app (ícono de engranaje).

4.  **Ejecutar**:
    ```bash
    npm run dev
    ```

## 📱 PWA Ready
La aplicación incluye un `manifest.json` y configuración para ser instalada como una aplicación nativa en dispositivos iOS y Android.

---
Creado con ❤️ para optimizar las finanzas personales.
