# Restaurante WhatsApp Bot – Render + Google Sheets (PROD READY)

Este repositorio contiene un bot de WhatsApp para restaurantes que:
- Responde por WhatsApp usando **WhatsApp Cloud API**.
- Ejecuta un flujo de reservas y guarda los datos en **Google Sheets**.
- Está preparado para desplegar en **Render** con buenas prácticas (helmet, rate limit, logs, reintentos).

---
## 1) Qué necesitas antes de desplegar
1. **Google Sheets**
   - Crea un Sheet nuevo y en la primera hoja (tab) pon estos encabezados EXACTOS en la fila 1:
     A) `Fecha_Reserva (AAAA-MM-DD)`  
     B) `Hora (HH:MM)`  
     C) `Nombre`  
     D) `Personas`  
     E) `Telefono`  
     F) `Origen (WhatsApp/Instagram)`  
     G) `Estado (Confirmada/Cancelada/No-Show)`  
     H) `Notas`
   - Copia el ID de la hoja (lo que va entre `/d/` y `/edit` en la URL). Ese será `SHEET_ID`.

2. **Service Account para Google Sheets**
   - Ve a https://console.cloud.google.com/ → crea un proyecto (si no tienes).
   - **Habilita** *Google Sheets API*.
   - Crea una **Service Account** y después una **Key** tipo **JSON**. Descarga el JSON.
   - Comparte tu Google Sheet con el **email de la Service Account** (rol: Editor), igual que si compartieras con una persona.
   - Convierte el JSON a **base64**:
     - macOS/Linux:
       ```bash
       base64 -w 0 key.json
       ```
     - Windows (PowerShell):
       ```powershell
       [Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))
       ```
   - Copia esa cadena (una línea). Será tu `GOOGLE_SERVICE_ACCOUNT`.

3. **WhatsApp Cloud API (Meta for Developers)**
   - Crea una app en https://developers.facebook.com/apps/ (tipo Business).
   - En **WhatsApp → Getting Started**, obtén:
     - `PHONE_NUMBER_ID`
     - `Permanent Access Token` (o temporal para pruebas; en producción usa permanente).
   - Elige un `VERIFY_TOKEN` (por ejemplo `resto2025`).

---
## 2) Despliegue en Render (sin Redis por ahora)
1. Sube este código a un repositorio en GitHub.
2. En https://render.com/ haz **New → Web Service**, conecta tu repo.
3. **Build Command**: `npm install`  
   **Start Command**: `npm start`
4. **Environment → Add Environment Variable** (añade todas):
   - `NODE_ENV=production`
   - `LOG_LEVEL=info`
   - `PORT=10000` *(Render ignorará esto y te dará un puerto, está bien)*
   - `VERIFY_TOKEN` = tu token (ej. `resto2025`)
   - `WHATSAPP_TOKEN` = tu Permanent Access Token
   - `PHONE_NUMBER_ID` = tu Phone Number ID
   - `SHEET_ID` = el ID del Google Sheet
   - `SHEET_TAB` = `Reservas`
   - `GOOGLE_SERVICE_ACCOUNT` = pega el base64 del JSON
   - `SESSION_TTL_MS` = `86400000` (24h)
5. Deploy. Copia la **URL pública** (ej: `https://resto-demo.onrender.com`).

---
## 3) Conectar el webhook en Meta
1. En tu app de Meta → WhatsApp → **Configuration** → **Webhook**.
2. `Callback URL` = `https://TU-URL.onrender.com/webhook`
3. `Verify Token` = el mismo que pusiste en Render.
4. **Verify and Save**.
5. En **Webhook Fields**, suscríbete a **messages**.

---
## 4) Probar end-to-end
- Escribe desde tu WhatsApp al número de prueba de WhatsApp Cloud.  
- Deberías recibir el mensaje de bienvenida + **botones**.  
- Sigue el flujo (personas → fecha → hora → nombre → confirmación).  
- Abre tu Google Sheet y verás la **reserva añadida**.

También puedes probar el envío manual:
```
GET https://TU-URL.onrender.com/test/send?to=593XXXXXXXXX&msg=Hola
```
> Requiere `WHATSAPP_TOKEN` y `PHONE_NUMBER_ID` configurados.

---
## 5) Estructura del proyecto
```
flow_restaurant.json     # definición del flujo conversacional
server.js                # Express server + webhook + endpoints de prueba
utils/
  ├─ flowEngine.js       # motor del flujo, guarda en Google Sheets
  ├─ whatsapp.js         # envío a Graph API con reintentos
  ├─ sheets.js           # cliente Google Sheets (Service Account)
  ├─ sessionStore.js     # sesiones en memoria con TTL (cámbialo por Redis si escalas)
  └─ logger.js           # pino logger
.env.example             # ejemplo de variables de entorno
```

---
## 6) Buenas prácticas incluidas
- **helmet** + **rate limit** en `/webhook`.
- **logger** con pino.
- **reintentos** exponenciales en llamadas a WhatsApp.
- **sesiones con TTL** (24h) para ventanas de interacción.
- **endpoints** de salud y prueba.

---
## 7) Personalizar el flujo
Edita `flow_restaurant.json`:
- Cambia textos y precios del menú (`menu`).
- Actualiza dirección y horarios (`location_hours`).
- Ajusta horarios de reserva válidos en `reserve_time`.

---
## 8) Siguientes mejoras (opcionales)
- Integrar **Redis** (persistence) cuando escales en Render.
- Agregar **recordatorios** con `node-cron` (ej., notificar el día de la reserva).
- Añadir **mensajes de plantilla** (HSM) para contactar fuera de la ventana de 24h.

---
## 9) Troubleshooting rápido
- **403 al verificar webhook** → `VERIFY_TOKEN` no coincide o la URL es incorrecta.
- **No guarda en Sheets** → comparte la hoja con el email de la Service Account y revisa `SHEET_ID`.
- **Botones no llegan** → número inválido o payload rechazado; revisa logs en Render.
- **Timeouts** → Render free puede dormir; sube de plan si necesitas latencia menor.

¡Listo! Estás para producción en Render.
