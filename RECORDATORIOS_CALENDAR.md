# Recordatorios en Google Calendar (9am / 4pm)

Cuando creas una **publicación nueva** en el calendario con personas asignadas, la app crea
**2 eventos** en Google Calendar (a las **9:00** y **16:00**, hora local del país de la tarjeta)
el día de la publicación, e **invita por correo** a cada persona.

```
Crear publicación  →  POST /api/calendar-reminders  →  Google Calendar
(con personas)        (cuenta organizadora OAuth)       2 eventos (9am, 4pm)
                                                         invita por email a cada persona
```

La cuenta organizadora (una cuenta de Google de Truora, p. ej. marketing/ops) es la que crea los
eventos. Cada persona los recibe como invitación y le aparecen en **su** calendario.

> Nota: un *service account* de Google **no puede invitar asistentes** sin delegación de Workspace.
> Por eso usamos OAuth de una cuenta real como organizadora.

---

## 1. Cargar los correos del equipo

Edita [`app/data/contacts.ts`](app/data/contacts.ts) y completa el campo `email` de cada persona
(debe ser el correo de su Google Calendar). Quien no tenga correo, se omite (se avisa en la app).

```ts
{ name: "Gabriela Cala", email: "gabriela@truora.com", telegram: "", role: "" },
```

## 2. Crear las credenciales de Google (una sola vez)

1. **Google Cloud Console** → crea/usa un proyecto → **APIs & Services**.
2. Habilita la **Google Calendar API**.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo *App de escritorio*.
   Guarda el **Client ID** y el **Client Secret**.
4. Consigue un **refresh token** para la cuenta organizadora (la que invitará):
   - Entra a [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
   - ⚙️ (arriba a la derecha) → marca **Use your own OAuth credentials** → pega Client ID y Secret.
   - En *Step 1*, scope: `https://www.googleapis.com/auth/calendar`.
   - **Authorize APIs** → inicia sesión con la cuenta organizadora → **Exchange authorization code for tokens**.
   - Copia el **Refresh token**.

## 3. Variables de entorno

En `.env.local` (local) y en **Vercel → Project Settings → Environment Variables** (producción):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=primary   # opcional; "primary" = calendario de la cuenta organizadora
```

Tras agregarlas en Vercel, **redespliega** para que tomen efecto.

---

## Comportamiento y límites (v1)

- Se crean **solo al crear** la publicación (no al editarla). Editar/borrar la tarjeta no actualiza
  ni elimina los eventos todavía.
- La zona horaria sale del **país de la tarjeta** (CO→Bogotá, PE→Lima, CL→Santiago, MX→CDMX,
  AR→Buenos Aires; LATAM→Bogotá).
- Si faltan credenciales o correos, la publicación **igual se guarda**; la app solo avisa que no se
  crearon los recordatorios.
