// ── Directorio de contactos del equipo (para los recordatorios de n8n) ──────────
//
// El calendario guarda a las personas solo por NOMBRE (array `people` de cada tarjeta).
// Para que n8n pueda enviarle el recordatorio a cada quien, aquí mapeamos ese nombre
// a su canal de contacto. Hoy usamos Telegram (es lo que ya tiene el workflow).
//
// CÓMO LLENAR EL chatId DE TELEGRAM:
//   1. La persona le escribe /start a tu bot de Telegram (el mismo que usas en n8n).
//   2. Abre en el navegador:
//        https://api.telegram.org/bot<TU_BOT_TOKEN>/getUpdates
//      y copia el número de "chat":{"id": ...} que aparece para esa persona.
//   3. Pégalo abajo en `telegram`.
//
// Mientras `telegram` esté vacío, el endpoint /api/reminders marca a esa persona como
// `channelReady: false` y n8n la salta (no intenta enviar a un chat inexistente).
//
// El `name` debe coincidir con el nombre que se usa en las tarjetas del calendario
// (array PEOPLE en app/page.tsx). El matcheo es tolerante a tildes/mayúsculas.

export interface Contact {
  /** Nombre tal cual aparece en las tarjetas del calendario */
  name: string;
  /** chat_id numérico de Telegram (como string). Vacío = aún sin configurar */
  telegram?: string;
  /**
   * Rol de la persona. Lo usa el AI Agent de n8n para ajustar la voz del mensaje.
   * Ejemplos del Sheet: Champion · Sales Account Executive · Head of Demand Generation ·
   * Head of Sales · BDR. Déjalo vacío si no aplica.
   */
  role?: string;
  /**
   * Correo de Google Calendar de la persona. Lo usan los recordatorios de calendario
   * (POST /api/calendar-reminders): se invita a este correo a los eventos 9am/4pm.
   * Sin correo, la persona se omite. Ver RECORDATORIOS_CALENDAR.md.
   */
  email?: string;
}

export const CONTACTS: Contact[] = [
  { name: "Ericka Ortegon",     telegram: "", role: "", email: "eortegon@truora.com" },
  { name: "Maria Juliana",      telegram: "", role: "", email: "mhernandez@truora.com" },
  { name: "Mafe Ramirez",       telegram: "", role: "", email: "framirez@truora.com" },
  { name: "Mariangel",          telegram: "", role: "", email: "" },
  { name: "Gabriela Cala",      telegram: "", role: "", email: "gcala@truora.com" },
  { name: "Alessandra Huapaya", telegram: "", role: "", email: "alessandra@truora.com" },
  { name: "Cesar Lengua",       telegram: "", role: "", email: "clengua@truora.com" },
  { name: "Manuela Peña",       telegram: "", role: "", email: "" },
  { name: "Daniel Bilbao",      telegram: "", role: "", email: "" },
  { name: "Daniel Villegas",    telegram: "", role: "", email: "dvillegas@truora.com" },
  { name: "Lony Milena",        telegram: "", role: "", email: "" },
  { name: "Christian Rojas",    telegram: "", role: "", email: "" },
  { name: "Paulina Gaviria",    telegram: "", role: "", email: "pgaviria@truora.com" },
];

/** Normaliza un nombre para comparar sin tildes ni mayúsculas. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Busca el contacto de una persona por nombre (tolerante a tildes/orden/subconjunto). */
export function findContact(personName: string): Contact | null {
  const target = normName(personName).split(/\s+/).filter((w) => w.length > 1);
  if (target.length === 0) return null;

  for (const c of CONTACTS) {
    const parts = normName(c.name).split(/\s+/).filter((w) => w.length > 1);
    if (parts.length === 0) continue;
    // coincide si uno es subconjunto del otro (ej. "Maria Juliana" ⊆ "Maria Juliana Hernandez")
    if (target.every((w) => parts.includes(w)) || parts.every((w) => target.includes(w))) {
      return c;
    }
  }
  return null;
}
