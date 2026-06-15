# Automatización n8n — Recordatorios de LinkedIn

Avisa por **Telegram** a cada persona del equipo lo que le toca publicar **hoy** en LinkedIn,
según la tarjeta del calendario (su **país** y su **tema/producto**), en su propio tono.

```
Schedule Trigger (8am)  →  GET /api/reminders  →  Split Reminders  →  ¿Tiene Telegram?  →  Telegram
   (cada mañana)            (de tu app)            (1 ítem por          (salta a quien        (envía el
                                                    persona)             no tiene chat_id)     recordatorio)
```

La **fuente de verdad es tu app** (Supabase), no un Google Sheet. n8n solo llama un endpoint
que ya devuelve todo masticado: persona + chat_id + país + tema + tono + mensaje sugerido.

---

## 1. Cómo funciona

1. **Schedule Trigger** corre cada mañana.
2. **Get reminders** hace `GET /api/reminders?date=<hoy>`. El endpoint:
   - Busca en `publications` las tarjetas cuyo **día de inicio = hoy**.
   - Las expande **una por persona** del array `people`.
   - A cada persona le adjunta su **chat_id de Telegram** (de `app/data/contacts.ts`),
     su **tono** (de `tone_profiles/`) y un **mensaje listo** (`defaultMessage`).
3. **Split Reminders** convierte el array `reminders` en un ítem por persona.
4. **¿Tiene Telegram?** deja pasar solo a quienes tienen `channelReady = true`
   (es decir, ya tienen `chat_id` configurado).
5. **Send a text message** (Telegram) envía `defaultMessage` al `chatId`.

### Ejemplo de la respuesta de `/api/reminders`

```jsonc
{
  "ok": true,
  "date": "2026-06-15",
  "count": 1,
  "reminders": [
    {
      "person": "Alessandra Huapaya",
      "chatId": "123456789",
      "channelReady": true,
      "email": null,
      "country": { "key": "PE", "label": "Peru", "flag": "🇵🇪" },
      "category": "Digital Identity",
      "publication": {
        "id": "s6",
        "title": "Minería peruana: actualización",
        "content": "El sector minero peruano…",
        "startDate": "2026-06-15",
        "endDate": "2026-06-15"
      },
      "tone": { "hasProfile": true, "style": "Estratégico-Comercial", "fileName": "perfil-tono-alessandra-huapaya.md" },
      "defaultMessage": "¡Hola Alessandra! 👋 Recordatorio de tu publicación de hoy…"
    }
  ]
}
```

---

## 2. Setup (una sola vez)

### a) Llenar los chat_id de Telegram
Edita [`app/data/contacts.ts`](../app/data/contacts.ts). Para cada persona:

1. Que le escriba `/start` a tu bot de Telegram (el mismo que usas en n8n).
2. Abre `https://api.telegram.org/bot<TU_BOT_TOKEN>/getUpdates` y copia el
   `chat.id` que aparece para esa persona.
3. Pégalo en el campo `telegram` de esa persona.

> Mientras esté vacío, el endpoint marca a esa persona como `channelReady: false`
> y el nodo **¿Tiene Telegram?** la salta (no falla el workflow).

### b) (Opcional pero recomendado) Proteger el endpoint con un token
Agrega en `.env.local` (y en las variables de entorno de Vercel):

```bash
REMINDERS_TOKEN=algo-largo-y-secreto
```

Si la defines, `/api/reminders` exige el header `Authorization: Bearer <token>`.
Si no la defines, el endpoint queda abierto (sirve para probar en local).

### c) Importar el workflow en n8n
1. En n8n: **Workflows → Import from File** → elige
   [`n8n/linkedin-reminder.json`](./linkedin-reminder.json).
   (O cópialo dentro de tu workflow actual "LinkedIn Reminder" reemplazando los nodos
   de Google Sheets por **Get reminders → Split Reminders**.)
2. Abre el nodo **Get reminders** y ajusta:
   - **URL** → `https://TU-APP.vercel.app/api/reminders` (tu dominio real de Vercel,
     o `http://localhost:3000/api/reminders` para probar en local).
   - **Header `Authorization`** → `Bearer <REMINDERS_TOKEN>` (o bórralo si no usas token).
3. Abre el nodo **Send a text message** (Telegram) y asigna tu **credencial de bot de Telegram**.
4. Ajusta la hora en **Schedule Trigger** si quieres otra distinta a las 8:00.
   > La hora del cron usa la zona horaria de tu instancia de n8n. El parámetro `date`
   > sí se calcula en `America/Bogota` dentro del nodo HTTP.

---

## 3. Probar

- **Manual:** abre el workflow y dale **Execute workflow**. Para forzar una fecha con
  datos, en **Get reminders** cambia temporalmente el query `date` a una fecha que tenga
  tarjetas (ej. `2026-06-15`).
- **Endpoint directo:**
  ```bash
  curl "http://localhost:3000/api/reminders?date=2026-06-15" \
    -H "Authorization: Bearer <REMINDERS_TOKEN>"
  ```

---

## 4. Variantes

- **Avisar la víspera:** en el query `date` del nodo HTTP usa mañana:
  `={{ $now.setZone('America/Bogota').plus({ days: 1 }).toFormat('yyyy-LL-dd') }}`.
- **Recordar todo el rango (no solo el día de inicio):** agrega el query `match=window`.
  Avisará cada día que la fecha caiga dentro de `[start_date, end_date]`.
- **Redactar el mensaje con IA (en el tono de la persona):** entre **¿Tiene Telegram?** y
  **Telegram** inserta tu nodo **AI Agent + OpenAI Chat Model** (como en tu workflow original).
  Pásale `defaultMessage`, `tone.style` y `tone.fileName` como contexto y manda la salida del
  agente como `text` del nodo de Telegram en vez de `defaultMessage`.
- **Cambiar de canal (WhatsApp / email):** el endpoint ya devuelve `email`; agrega el campo
  correspondiente en `app/data/contacts.ts` y cambia el nodo final por el de WhatsApp/Email.

---

## 5. Archivos relacionados

| Archivo | Qué hace |
|---|---|
| `app/api/reminders/route.ts` | Endpoint que arma los recordatorios del día |
| `app/data/contacts.ts` | Mapa persona → chat_id de Telegram / email |
| `app/api/publications/route.ts` | CRUD del calendario (ahora persiste `category`) |
| `n8n/linkedin-reminder.json` | Workflow importable |
