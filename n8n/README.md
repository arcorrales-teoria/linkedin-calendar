# Automatización n8n — Recordatorios de LinkedIn

Avisa por **Telegram** a cada persona del equipo lo que le toca publicar **hoy** en LinkedIn,
con el mensaje redactado por **IA** en la voz de marca de Truora, según la tarjeta del calendario
(su **país** y su **tema/producto**) y su **rol**.

```
Schedule Trigger     →  GET /api/reminders  →  Split        →  ¿Tiene Telegram?  →  AI Agent      →  Telegram
(Lun/Mar/Jue 10am)      (de tu app)             Reminders       (salta a quien       (OpenAI redacta   (envía el
                                                (1 x persona)    no tiene chat_id)    en tono Truora)   mensaje)
```

La **fuente de verdad es tu app** (Supabase), no el Google Sheet anterior. n8n llama un endpoint
que ya devuelve todo masticado: persona + rol + chat_id + país + tema + tono + idea base.
El **AI Agent** arma el texto final (es el mismo agente y prompt de tu workflow original, adaptado).

---

## 1. Qué cambió vs. tu workflow original

| Antes | Ahora |
|---|---|
| `Get row(s) in sheet` (Google Sheet) | `Get reminders` → `GET /api/reminders` (calendario en Supabase) |
| `Loop Over Items` + `Replace Me` (vacío, loop a medias) | `Split Reminders` + `¿Tiene Telegram?` (1 ítem por persona, salta a quien no tiene chat) |
| Columnas `col_1`, `Rol`, `País`, `Telegram ID` | Campos del endpoint: `person`, `role`, `country.label`, `chatId` |
| Tema **solo** por día de la semana | Tema = **categoría de la tarjeta**; si la tarjeta no trae tema, cae a la rotación por día (Lun regulación / Mar producto / Jue trending) |

Se conservan **igual**: AI Agent, OpenAI Chat Model (`gpt-4.1-mini`), nodo de Telegram, sus
credenciales, el horario (Lun/Mar/Jue 10am) y el link a tu generador en Lovable.

---

## 2. Cómo funciona

1. **Schedule Trigger** corre Lun/Mar/Jue a las 10:00.
2. **Get reminders** hace `GET /api/reminders?date=<hoy>`. El endpoint:
   - Busca en `publications` las tarjetas cuyo **día de inicio = hoy**.
   - Las expande **una por persona** del array `people`.
   - A cada persona le adjunta su **rol** y **chat_id** (de `app/data/contacts.ts`),
     su **tono** (de `tone_profiles/`), el **país y tema** de la tarjeta, y la **idea base**.
3. **Split Reminders** convierte el array `reminders` en un ítem por persona.
4. **¿Tiene Telegram?** deja pasar solo a quienes tienen `channelReady = true` (ya tienen `chat_id`).
5. **AI Agent + OpenAI** redactan el mensaje en la voz de Truora, usando el tema de la tarjeta
   (o la rotación por día si la tarjeta no trae tema) y las reglas según rol.
6. **Send a text message** (Telegram) envía la salida del agente al `chatId` de esa persona.

### Ejemplo de la respuesta de `/api/reminders`

```jsonc
{
  "ok": true,
  "date": "2026-06-15",
  "count": 1,
  "reminders": [
    {
      "person": "Alessandra Huapaya",
      "role": "BDR",
      "chatId": "123456789",
      "channelReady": true,
      "email": null,
      "country": { "key": "PE", "label": "Peru", "flag": "🇵🇪" },
      "category": "Digital Identity",
      "publication": {
        "id": "s6", "title": "Minería peruana: actualización",
        "content": "El sector minero peruano…", "startDate": "2026-06-15", "endDate": "2026-06-15"
      },
      "tone": { "hasProfile": true, "style": "Estratégico-Comercial", "fileName": "perfil-tono-alessandra-huapaya.md" },
      "defaultMessage": "¡Hola Alessandra! 👋 …"  // fallback por si quitas el AI Agent
    }
  ]
}
```

---

## 3. Setup (una sola vez)

### a) Llenar Telegram y Rol de cada persona
Edita [`app/data/contacts.ts`](../app/data/contacts.ts). Para cada persona:

- **`telegram`** (chat_id): que le escriba `/start` a tu bot, abre
  `https://api.telegram.org/bot<TU_BOT_TOKEN>/getUpdates` y copia el `chat.id`.
- **`role`**: su rol para la voz del mensaje (Champion · Sales Account Executive ·
  Head of Demand Generation · Head of Sales · BDR). Son los mismos roles del Sheet anterior.

> Mientras `telegram` esté vacío, el endpoint marca a esa persona como `channelReady: false`
> y el nodo **¿Tiene Telegram?** la salta (no falla el workflow).

### b) (Opcional pero recomendado) Proteger el endpoint con un token
En `.env.local` (y en las variables de entorno de Vercel):

```bash
REMINDERS_TOKEN=algo-largo-y-secreto
```

Si la defines, `/api/reminders` exige el header `Authorization: Bearer <token>`.

### c) Importar el workflow en n8n
1. **Workflows → Import from File** → [`n8n/linkedin-reminder.json`](./linkedin-reminder.json).
   (Trae los mismos IDs de credenciales de tu instancia, así que el AI/OpenAI/Telegram quedan
   enganchados solos.)
2. Abre **Get reminders** y ajusta:
   - **URL** → `https://TU-APP.vercel.app/api/reminders` (tu dominio real, o
     `http://localhost:3000/api/reminders` para probar).
   - **Header `Authorization`** → `Bearer <REMINDERS_TOKEN>` (o bórralo si no usas token).
3. Verifica que **OpenAI Chat Model** y **Send a text message** tengan sus credenciales.
4. Activa el workflow.

> La hora del cron usa la zona horaria de tu instancia de n8n. El parámetro `date` sí se calcula
> en `America/Bogota` dentro del nodo HTTP.

---

## 4. Probar

- **Manual:** abre el workflow y dale **Execute workflow**. Para forzar una fecha con datos, en
  **Get reminders** cambia temporalmente el query `date` a una fecha que tenga tarjetas.
- **Endpoint directo:**
  ```bash
  curl "http://localhost:3000/api/reminders?date=2026-06-03" \
    -H "Authorization: Bearer <REMINDERS_TOKEN>"
  ```

---

## 5. Variantes

- **Avisar la víspera:** en el query `date` usa
  `={{ $now.setZone('America/Bogota').plus({ days: 1 }).toFormat('yyyy-LL-dd') }}`.
- **Recordar todo el rango (no solo el día de inicio):** agrega el query `match=window`.
- **Sin IA (mensaje plano):** el endpoint ya trae `defaultMessage` listo. Borra el AI Agent +
  OpenAI y en Telegram usa `text = {{ $('Split Reminders').item.json.defaultMessage }}`.
- **Cambiar de canal (WhatsApp / email):** el endpoint ya devuelve `email`; agrega el campo
  en `app/data/contacts.ts` y cambia el nodo final.

---

## 6. Archivos relacionados

| Archivo | Qué hace |
|---|---|
| `app/api/reminders/route.ts` | Endpoint que arma los recordatorios del día |
| `app/data/contacts.ts` | Mapa persona → chat_id de Telegram · rol · email |
| `app/api/publications/route.ts` | CRUD del calendario (ahora persiste `category`) |
| `n8n/linkedin-reminder.json` | Workflow importable (tu flujo, ya conectado a la app) |
