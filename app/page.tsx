"use client";

import { useState, useRef, useEffect, useMemo, useCallback, createContext, useContext } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CountryKey = "LATAM" | "CO" | "AR" | "PE" | "CL" | "MX";
type EventRole  = "single" | "start" | "middle" | "end";

interface Country {
  key: CountryKey;
  label: string;
  flag: string;
  color: string;
  colorDark: string;
  bgLight: string;
  bgDark: string;
}

// Productos de Truora; cada uno define el ICP que se busca en Apollo.
// "About Truora" es para posts generales (no de un producto puntual); igual recomienda ICPs.
const PRODUCT_CATEGORIES = [
  "Digital Identity", "Background Checks", "Fraude", "Firma Digital",
  "WA Onboarding", "Onboarding (General)", "WA Banking", "WA Agentic",
  "About Truora",
] as const;
type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface Publication {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  content: string;
  country: CountryKey;
  category?: ProductCategory; // producto seleccionado al crear la tarjeta; dispara la búsqueda en Apollo
  people: string[];
}

interface ToneProfile {
  personName: string;
  linkedinUrl: string;
  sampleText: string;
  usesEmojis: boolean;
  usesHashtags: boolean;
  usesQuestions: boolean;
  usesLists: boolean;
  avgWordsPerPost: number;
  writingStyle: "profesional" | "conversacional" | "inspiracional" | "educativo";
  updatedAt: string;
}

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; date: string }
  | { mode: "view";   pub: Publication }
  | { mode: "edit";   pub: Publication };

// ── Constants ─────────────────────────────────────────────────────────────────

const COUNTRIES: Country[] = [
  { key:"LATAM", label:"LATAM",     flag:"🌎", color:"#4f46e5", colorDark:"#818cf8", bgLight:"rgba(79,70,229,0.12)",  bgDark:"rgba(129,140,248,0.18)" },
  { key:"CO",    label:"Colombia",  flag:"🇨🇴", color:"#b45309", colorDark:"#fbbf24", bgLight:"rgba(180,83,9,0.12)",   bgDark:"rgba(251,191,36,0.18)"  },
  { key:"AR",    label:"Argentina", flag:"🇦🇷", color:"#1d4ed8", colorDark:"#60a5fa", bgLight:"rgba(29,78,216,0.12)",  bgDark:"rgba(96,165,250,0.18)"  },
  { key:"PE",    label:"Peru",      flag:"🇵🇪", color:"#b91c1c", colorDark:"#f87171", bgLight:"rgba(185,28,28,0.12)",  bgDark:"rgba(248,113,113,0.18)" },
  { key:"CL",    label:"Chile",     flag:"🇨🇱", color:"#065f46", colorDark:"#34d399", bgLight:"rgba(6,95,70,0.12)",    bgDark:"rgba(52,211,153,0.18)"  },
  { key:"MX",    label:"Mexico",    flag:"🇲🇽", color:"#15803d", colorDark:"#4ade80", bgLight:"rgba(21,128,61,0.12)",  bgDark:"rgba(74,222,128,0.18)"  },
];

const CMAP = Object.fromEntries(COUNTRIES.map(c => [c.key, c])) as Record<CountryKey, Country>;

const DAYS        = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_ABR  = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

const PEOPLE = [
  "Ericka Ortegon", "Maria Juliana", "Mafe Ramirez", "Mariangel",
  "Gabriela Cala", "Alessandra Huapaya", "Cesar Lengua", "Manuela Peña", "Daniel Bilbao",
  "Daniel Villegas", "Lony Milena", "Christian Rojas",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date();
function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function uid() { return Math.random().toString(36).slice(2,10); }

function loadToneProfile(personName: string): ToneProfile | null {
  try {
    const raw = localStorage.getItem(`tone_${personName}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToneProfile(profile: ToneProfile) {
  try { localStorage.setItem(`tone_${profile.personName}`, JSON.stringify(profile)); } catch {}
}

function normName(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "");
}

function fileMatchesPerson(file: string, person: string) {
  const fn = normName(file);
  const parts = normName(person).split(/\s+/).filter(p => p.length > 2);
  return parts.length > 0 && parts.every(p => fn.includes(p));
}

function samePerson(a: string, b: string) {
  const pa = normName(a).split(/\s+/).filter(w => w.length > 1);
  const pb = normName(b).split(/\s+/).filter(w => w.length > 1);
  if (pa.length === 0 || pb.length === 0) return false;
  return pa.every(w => pb.includes(w)) || pb.every(w => pa.includes(w));
}

function analyzeTone(sampleText: string, personName: string, linkedinUrl: string): ToneProfile {
  const posts = sampleText.split(/\n?---+\n?/).filter(p => p.trim().length > 30);
  const full  = sampleText.toLowerCase();

  const usesEmojis    = /\p{Emoji_Presentation}/u.test(sampleText);
  const usesHashtags  = /#\w+/.test(sampleText);
  const usesQuestions = /[¿?]/.test(sampleText);
  const usesLists     = /^[\s]*[-•·*]\s/m.test(sampleText) || /^\d+[.)]\s/m.test(sampleText);

  const wordCounts = posts.map(p => p.trim().split(/\s+/).length);
  const avgWordsPerPost = wordCounts.length
    ? Math.round(wordCounts.reduce((a,b)=>a+b,0) / wordCounts.length) : 80;

  const scores = {
    conversacional: ["la verdad","te cuento","oye","sabes qué","no te miento","honestamente","siendo honesto"].filter(w=>full.includes(w)).length,
    inspiracional:  ["transformar","impacto","misión","propósito","lograr","creer","sueño","cambio","posible"].filter(w=>full.includes(w)).length,
    educativo:      ["clave","aprende","descubre","estrategia","dato","tip","consejo","paso","método","guía"].filter(w=>full.includes(w)).length,
    profesional:    ["mediante","asimismo","por tanto","en consecuencia","cabe destacar","es importante","resulta"].filter(w=>full.includes(w)).length,
  };

  const writingStyle = (Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0]) as ToneProfile["writingStyle"];

  return { personName, linkedinUrl, sampleText, usesEmojis, usesHashtags, usesQuestions, usesLists, avgWordsPerPost, writingStyle, updatedAt: new Date().toISOString() };
}

const FOCUS_OPTIONS = ["Reconocimiento de marca","Liderazgo de pensamiento","Generación de leads","Engagement","Educativo","Anuncio","Historia personal"];
const TONE_OPTIONS  = ["Profesional","Conversacional","Inspiracional","Educativo","Directo","Storytelling"];
const LANG_OPTIONS  = ["Español","English","Português"];
const LENGTH_OPTIONS = ["Corto (1-2 párrafos)","Medio (3-4 párrafos)","Largo (5+ párrafos)"];

function buildGeneratedPost(topic: string, tone: string, focus: string, length: string, profile: ToneProfile | null): string {
  // Extract clean title — only the first line, strip any auto-filled context
  const cleanTitle = topic.split("\n")[0].trim();
  if (!cleanTitle) return "";

  const short  = length.startsWith("Corto");
  const long   = length.startsWith("Largo");
  const style  = (profile?.writingStyle ?? tone.toLowerCase()) as ToneProfile["writingStyle"];
  const emojis    = profile ? profile.usesEmojis    : (tone === "Conversacional" || tone === "Inspiracional");
  const hashtags  = profile ? profile.usesHashtags   : true;
  const useLists  = profile ? profile.usesLists      : !short;
  const useQ      = profile ? profile.usesQuestions  : true;

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const e = (emoji: string) => emojis ? emoji + " " : "";

  // ── 1. HOOK ────────────────────────────────────────────────────────────────
  const hooks: Record<string, string[]> = {
    conversacional: [
      `${e("💬")}Hace poco me hice una pregunta sobre ${cleanTitle} que no me ha dejado de rondar.`,
      `${e("🤔")}${cleanTitle}: hay algo sobre esto que pocas personas se atreven a decir en voz alta.`,
      `${e("👇")}Te cuento algo que aprendí sobre ${cleanTitle} que cambió mi forma de verlo.`,
      `${e("💡")}Sobre ${cleanTitle} se habla mucho. Pero lo que realmente importa suele quedarse afuera de la conversación.`,
    ],
    inspiracional: [
      `${e("🚀")}${cleanTitle} no es una tendencia. Es un cambio de era.`,
      `${e("✨")}Lo más apasionante de ${cleanTitle} es que todavía estamos en el principio.`,
      `${e("🌟")}Hay momentos en que una industria cambia para siempre. ${cleanTitle} es uno de esos momentos.`,
      `${e("🎯")}${cleanTitle} está redefiniendo las reglas. Y quienes lo entiendan primero tendrán una ventaja real.`,
    ],
    educativo: [
      `${e("📊")}3 cosas que vale la pena entender sobre ${cleanTitle} antes de tomar decisiones:`,
      `${e("💡")}${cleanTitle}: lo que realmente importa (y lo que se sobrevalora).`,
      `${e("🔑")}Si tuviera que resumir ${cleanTitle} en lo esencial, empezaría por aquí.`,
      `${e("📌")}La mayoría confunde el qué con el cómo cuando habla de ${cleanTitle}. Aquí la diferencia:`,
    ],
    profesional: [
      `${e("📌")}${cleanTitle}: una perspectiva que vale la pena tener en cuenta.`,
      `${e("🔑")}En el sector, pocos temas generan tanto debate como ${cleanTitle}. Y con razón.`,
      `${e("📊")}${cleanTitle} sigue siendo uno de los ejes más relevantes del mercado actual.`,
      `${e("💼")}Hablemos de ${cleanTitle}. Hay más matices de los que suelen discutirse.`,
    ],
  };
  const hook = pick(hooks[style] ?? hooks.profesional);

  // ── 2. BODY ────────────────────────────────────────────────────────────────
  const bodies: Record<string, string[]> = {
    "Reconocimiento de marca": [
      `En este espacio, lo que más importa no es la tecnología que usas, sino cómo la combinas con el conocimiento de tu equipo y la confianza que construyes con tus clientes.\n\nAlgunas cosas que hemos visto consistentemente:\n${useLists ? "• La velocidad de adopción depende del nivel de confianza en la solución\n• Los mejores resultados vienen de equipos que entienden el porqué, no solo el cómo\n• La consistencia de ejecución siempre supera la brillantez del diseño" : "La velocidad de adopción depende del nivel de confianza en la solución. Los mejores resultados vienen de equipos que entienden el porqué. Y la consistencia de ejecución siempre supera la brillantez del diseño."}`,
      `Es una conversación que llevamos tiempo teniendo con clientes y aliados en la región. Y cada vez que la profundizamos, aparecen los mismos patrones.\n\n${useLists ? "• El reto no es solo técnico — es cultural y de procesos\n• Las empresas que avanzan más rápido saben exactamente qué problema están resolviendo\n• La claridad de propósito vale más que cualquier feature" : "El reto no es solo técnico, es cultural. Las empresas que avanzan más rápido saben exactamente qué problema están resolviendo. La claridad de propósito vale más que cualquier feature."}`,
    ],
    "Liderazgo de pensamiento": [
      `El mercado en LATAM está en un momento particular. No es que falte tecnología — es que estamos aprendiendo a usarla bien.\n\n${useLists ? "Lo que me parece más relevante hoy:\n• Los modelos de mercados maduros no siempre se trasladan directamente\n• La regulación local define los tiempos, no solo la tecnología\n• Las empresas que ganan son las que entienden el contexto antes de ejecutar" : "Los modelos de mercados maduros no siempre se trasladan directamente. La regulación local define los tiempos. Y las empresas que ganan son las que entienden el contexto antes de ejecutar."}`,
      `Hay una tensión interesante en la industria alrededor de este tema. Por un lado, la urgencia de moverse rápido. Por el otro, la necesidad de hacerlo bien.\n\nLos equipos que mejor navegan esa tensión tienen algo en común: definen sus prioridades con mucha claridad y no persiguen cada nueva tendencia. Construyen sobre bases sólidas.`,
    ],
    "Educativo": [
      `Esto es lo que he visto que marca la diferencia en la práctica:\n\n${useLists ? "1. Empezar con el problema correcto — no con la solución más llamativa\n2. Validar supuestos antes de invertir en escalar\n3. Medir lo que importa, no lo que es fácil de medir\n4. Construir para el usuario final, aunque el comprador sea otro" : "Primero: empezar con el problema correcto. Segundo: validar supuestos antes de escalar. Tercero: medir lo que importa. Y cuarto: construir siempre para el usuario final, aunque el comprador sea otro."}\n\nSuena básico. Pero la mayoría de los errores en este espacio vienen de saltarse alguno de estos pasos.`,
      `Tres cosas que funcionan:\n\n${useLists ? "1. La simplicidad gana: los mejores flujos se entienden en segundos\n2. El contexto local importa: lo que convierte en México no es igual que en Colombia o Perú\n3. La integración es el cuello de botella: no la tecnología, sino cómo conecta con lo que ya existe" : "La simplicidad gana — los mejores flujos se entienden en segundos. El contexto local importa — cada mercado tiene su lógica. Y la integración suele ser el verdadero cuello de botella, no la tecnología en sí."}`,
    ],
    "Generación de leads": [
      `Si estás evaluando cómo abordarlo en tu organización, probablemente te estás haciendo estas preguntas:\n\n${useLists ? "• ¿Por dónde empiezo?\n• ¿Cuánto tiempo toma ver resultados reales?\n• ¿Cómo lo integro con lo que ya tenemos?" : "¿Por dónde empiezo? ¿Cuánto tiempo toma ver resultados? ¿Cómo lo integro con lo que ya tengo?"}\n\nHemos recorrido ese camino con muchos equipos en la región. Cada caso es distinto, pero hay patrones que se repiten.`,
      `La pregunta que más escucho es: ¿cómo sé si mi equipo está listo para dar el siguiente paso?\n\nLa respuesta corta: si ya tienes claro el problema que quieres resolver, ya estás listo. El resto se construye sobre eso.\n\nLo que más frena a los equipos no es la tecnología — es la falta de claridad interna sobre qué quieren lograr.`,
    ],
    "Anuncio": [
      `Llevamos tiempo trabajando en esto y hoy podemos hablarlo con más detalle.\n\nRepresenta para nosotros algo más que un hito — es la validación de que el camino que elegimos tiene sentido. Y el mejor indicador de eso son los resultados que estamos viendo con nuestros clientes en la región.`,
      `Esto no ocurre de la noche a la mañana. Hay mucho trabajo detrás: conversaciones difíciles, decisiones que no fueron obvias y un equipo que no dejó de empujar cuando las cosas se pusieron complejas.\n\nHoy lo podemos decir con claridad: valió la pena.`,
    ],
    "Historia personal": [
      `Recuerdo la primera vez que me encontré de frente con este problema. No tenía una respuesta clara, y lo más honesto que pude hacer fue reconocerlo.\n\nLo que encontré después fue más valioso que cualquier solución predefinida: una comunidad construyendo respuestas desde sus propios contextos, sin esperar que alguien de afuera les dijera cómo hacerlo.`,
      `Hay semanas que se quedan. Esta fue una de esas.\n\nConversaciones que me recordaron por qué vale la pena hacer lo que hacemos. No siempre se puede medir el impacto de inmediato. Pero cuando lo ves de cerca, es difícil no renovar el compromiso.`,
    ],
    "Engagement": [
      `Me quedo pensando en algo que escuché esta semana.\n\nHay una brecha entre cómo las empresas perciben este tema y cómo lo viven quienes están en la operación día a día. Y esa brecha, cuando se ignora, es donde suelen aparecer los problemas más difíciles de resolver.`,
      `Es uno de esos temas donde todos tienen una opinión, pero pocos comparten los aprendizajes reales — los que vienen de haberlo intentado, ajustado y vuelto a intentar.\n\nEso es lo que más valor le encuentro a estas conversaciones: lo que no aparece en los decks.`,
    ],
  };
  const bodyOptions = bodies[focus] ?? bodies["Reconocimiento de marca"];
  let body = pick(bodyOptions);

  if (long) {
    body += `\n\nLo que más me llama la atención es que las organizaciones que están avanzando más rápido no son necesariamente las más grandes. Son las que tienen mayor claridad sobre lo que quieren construir y por qué lo están haciendo.`;
  }

  // ── 3. CALL TO ACTION ──────────────────────────────────────────────────────
  const ctas: Record<string, string[]> = {
    conversacional: [
      `¿Te ha pasado algo parecido? Me gustaría leer tu perspectiva en los comentarios${emojis ? " 👇" : "."}`,
      `¿Cómo lo estás viviendo desde tu industria o mercado?`,
      `¿Coincides? ¿O lo ves diferente desde donde estás?`,
    ],
    inspiracional: [
      `¿Qué parte de este proceso te parece más desafiante en tu contexto?`,
      `¿Dónde estás tú en este camino? Me interesa saberlo.`,
      `¿Qué te falta para dar el siguiente paso?${emojis ? " 🚀" : ""}`,
    ],
    educativo: [
      `¿Agregarías algo a esta lista? Comparte en los comentarios.`,
      `¿Cuál de estos puntos es el más relevante para tu equipo hoy?`,
      `¿Qué otras preguntas te surgen al respecto? Las leo.`,
    ],
    profesional: [
      `¿Cuál es tu lectura de cómo está evolucionando esto en tu mercado?`,
      `Me interesa saber cómo están abordando este tema en sus organizaciones.`,
      `¿Están viendo la misma dinámica desde su posición?`,
    ],
  };
  const cta = useQ
    ? pick(ctas[style] ?? ctas.profesional)
    : `Si quieres conversar sobre esto, escríbeme directamente.${emojis ? " ✉️" : ""}`;

  // ── ASSEMBLE ───────────────────────────────────────────────────────────────
  return [hook, body, cta].filter(Boolean).join("\n\n");
}
function formatDisplayDate(ds: string): string {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0,2).toUpperCase();
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year,month,1).getDay();
  const dim   = new Date(year,month+1,0).getDate();
  const dip   = new Date(year,month,0).getDate();
  const cells: Date[] = [];
  for (let i=first-1; i>=0; i--) cells.push(new Date(year,month-1,dip-i));
  for (let d=1; d<=dim; d++) cells.push(new Date(year,month,d));
  let e=1; while (cells.length%7!==0) cells.push(new Date(year,month+1,e++));
  const weeks: Date[][] = [];
  for (let i=0; i<cells.length; i+=7) weeks.push(cells.slice(i,i+7));
  return weeks;
}

function eventsForDay(day: Date, pubs: Publication[]): Array<{pub:Publication; role:EventRole}> {
  const ds = toDateStr(day);
  return pubs
    .filter(p => ds >= p.startDate && ds <= p.endDate)
    .map(p => {
      const role: EventRole = p.startDate===p.endDate ? "single"
        : ds===p.startDate ? "start" : ds===p.endDate ? "end" : "middle";
      return { pub:p, role };
    });
}

function getWeekEvents(week: Date[], pubs: Publication[]) {
  const ws = toDateStr(week[0]);
  const we = toDateStr(week[6]);
  return pubs
    .filter(p => p.endDate >= ws && p.startDate <= we)
    .map(p => {
      const startCol = p.startDate <= ws ? 0 : week.findIndex(d => toDateStr(d) === p.startDate);
      const endCol   = p.endDate   >= we ? 6 : week.findIndex(d => toDateStr(d) === p.endDate);
      return { pub: p, startCol, endCol };
    });
}

function layoutWeekEvents(events: Array<{pub:Publication; startCol:number; endCol:number}>) {
  const rows: Array<Array<{pub:Publication; startCol:number; endCol:number}>> = [];
  for (const ev of events) {
    let placed = false;
    for (const row of rows) {
      if (!row.some(e => e.startCol <= ev.endCol && e.endCol >= ev.startCol)) {
        row.push(ev); placed = true; break;
      }
    }
    if (!placed) rows.push([ev]);
  }
  return rows;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED: Publication[] = [
  { id:"s1", startDate:toDateStr(TODAY),             endDate:toDateStr(TODAY),             title:"5 claves para crecer en LinkedIn",   content:"Crecer en LinkedIn requiere consistencia y valor genuino. En LATAM, la clave está en conectar con la comunidad de forma auténtica.",    country:"LATAM", people:["Ericka Ortegon"] },
  { id:"s2", startDate:toDateStr(addDays(TODAY,2)),  endDate:toDateStr(addDays(TODAY,4)),  title:"Colombia: mercado en expansión",     content:"El mercado colombiano evoluciona rápido y ofrece oportunidades únicas para empresas B2B.",         country:"CO",    people:["Maria Juliana","Mafe Ramirez"] },
  { id:"s3", startDate:toDateStr(addDays(TODAY,4)),  endDate:toDateStr(addDays(TODAY,4)),  title:"Fintech argentina: tendencias 2026", content:"El sector fintech en Argentina está en pleno boom.", country:"AR",    people:["Daniel Bilbao"] },
  { id:"s4", startDate:toDateStr(addDays(TODAY,7)),  endDate:toDateStr(addDays(TODAY,8)),  title:"Estrategia B2B para Chile",          content:"B2B en Chile requiere un enfoque diferente al resto de LATAM.",                                country:"CL",    people:["Gabriela Cala","Manuela Peña"] },
  { id:"s5", startDate:toDateStr(addDays(TODAY,10)), endDate:toDateStr(addDays(TODAY,10)), title:"Ecosistema startup México",           content:"CDMX se consolida como el hub startup de LATAM.", country:"MX",    people:["Cesar Lengua"] },
  { id:"s6", startDate:toDateStr(addDays(TODAY,3)),  endDate:toDateStr(addDays(TODAY,3)),  title:"Minería peruana: actualización",     content:"El sector minero peruano sigue atrayendo inversión internacional.",            country:"PE",    people:["Alessandra Huapaya"] },
];

// ── useClickOutside ───────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

// ── PersonBadge ───────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  ["#4f46e5","#fff"], ["#b45309","#fff"], ["#1d4ed8","#fff"],
  ["#b91c1c","#fff"], ["#065f46","#fff"], ["#15803d","#fff"],
];

function PersonBadge({ name, size = 24 }: { name: string; size?: number }) {
  const [bg, fg] = BADGE_COLORS[name.charCodeAt(0) % BADGE_COLORS.length];
  return (
    <span
      title={name}
      role="img"
      aria-label={name}
      style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:size, height:size, borderRadius:"50%",
        background:bg, color:fg,
        fontSize:Math.max(size * 0.40, 9),
        fontWeight:700,
        border:"2px solid rgba(255,255,255,0.60)",
        flexShrink:0,
        boxShadow:"0 2px 6px rgba(0,0,0,0.20)",
        letterSpacing:"-0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}

// ── IconTile — rounded-square tile with a thin-stroke icon ───────────────────

// Cuando un contenedor (HelpCard) está activo, ilumina los IconTile que lleva dentro.
const IconTileActive = createContext(false);

function IconTile({ children, size = 38, active: activeProp }: { children: React.ReactNode; size?: number; active?: boolean }) {
  const ctx = useContext(IconTileActive);
  const active = activeProp ?? ctx;
  return (
    <span aria-hidden="true" style={{
      width:size, height:size, borderRadius:12, flexShrink:0,
      background: active
        ? "linear-gradient(165deg, rgba(var(--accent-rgb),0.30) 0%, rgba(var(--accent-rgb),0.12) 100%)"
        : "var(--icon-tile-bg)",
      border:`1px solid ${active ? "rgba(var(--accent-rgb),0.55)" : "var(--icon-tile-border)"}`,
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      boxShadow: active ? "var(--icon-tile-glow)" : "var(--icon-tile-shadow)",
      transform: active ? "translateY(-1px)" : "none",
      transition:"background 240ms var(--ease-premium), border-color 240ms var(--ease-premium), box-shadow 240ms var(--ease-premium), color 240ms var(--ease-premium), transform 240ms var(--ease-premium)",
    }}>
      {children}
    </span>
  );
}

// ── Ayuda interactiva ─────────────────────────────────────────────────────────
// Nada aparece al entrar. Al pasar el cursor por una herramienta, esta se ilumina
// y revela su explicación. Dos formatos:
//   · HelpCard  → tarjeta que crece y muestra una franja al hacer hover.
//   · HintZone  → envuelve botones/controles y muestra un globo flotante al hover.

const INFO_ICON = (
  <span aria-hidden="true" style={{
    flexShrink:0, width:18, height:18, borderRadius:"50%", marginTop:1,
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    background:"rgba(var(--accent-rgb),0.16)", color:"var(--accent)",
    fontSize:12, fontWeight:700, fontFamily:"var(--font-sans)", lineHeight:1,
  }}>i</span>
);

// Tarjeta que se ilumina al hover y revela una franja explicativa debajo del contenido.
function HelpCard({
  hint, title, children, contentStyle, style,
}: {
  hint: string; title: string; children: React.ReactNode;
  contentStyle?: React.CSSProperties; style?: React.CSSProperties;
}) {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={e => { if (!ref.current?.contains(e.relatedTarget as Node)) setActive(false); }}
      style={{
        background:"var(--card-bg)",
        border:`1px solid ${active ? "rgba(var(--accent-rgb),0.45)" : "var(--card-border)"}`,
        borderRadius:16, padding:"22px 24px",
        boxShadow: active
          ? "0 0 0 1px rgba(var(--accent-rgb),0.22), 0 14px 36px -16px rgba(var(--accent-rgb),0.40), var(--shadow-card)"
          : "var(--shadow-card)",
        transition:"border-color 240ms var(--ease-premium), box-shadow 240ms var(--ease-premium), transform 240ms var(--ease-premium)",
        transform: active ? "translateY(-1px)" : "none",
        position:"relative",
        ...style,
      }}
    >
      <IconTileActive.Provider value={active}>
        <div style={contentStyle}>{children}</div>
      </IconTileActive.Provider>

      <div aria-hidden={!active} role="note" style={{
        overflow:"hidden",
        maxHeight: active ? 220 : 0,
        opacity: active ? 1 : 0,
        marginTop: active ? 16 : 0,
        transition:"max-height 320ms var(--ease-premium), opacity 220ms ease, margin-top 320ms var(--ease-premium)",
      }}>
        <div style={{
          borderTop:"1px dashed var(--cal-border)", paddingTop:13,
          display:"flex", gap:10, alignItems:"flex-start",
        }}>
          {INFO_ICON}
          <div style={{ minWidth:0 }}>
            <strong style={{ display:"block", fontSize:12.5, fontWeight:700, color:"var(--accent)", marginBottom:3, letterSpacing:"0.01em" }}>
              {title}
            </strong>
            <p style={{ fontSize:12.5, lineHeight:1.55, color:"var(--text-secondary)", fontWeight:500 }}>
              {hint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Globo flotante compartido (posición fija para no recortarse dentro de modales/scroll).
type HintRect = { x: number; top: number; bottom: number };
function FloatingTip({ rect, hint, title }: { rect: HintRect; hint: string; title?: string }) {
  const placeBelow = rect.top < 170;
  return (
    <span role="tooltip" className="animate-fade-in" style={{
      position:"fixed",
      left: Math.min(Math.max(rect.x, 144), (typeof window !== "undefined" ? window.innerWidth : 1024) - 144),
      top: placeBelow ? rect.bottom + 10 : rect.top - 10,
      transform: placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      width:268, maxWidth:"calc(100vw - 24px)",
      padding:"12px 14px", borderRadius:11,
      background:"var(--menu-bg)",
      border:"1px solid rgba(var(--accent-rgb),0.30)",
      boxShadow:"var(--shadow-dropdown)",
      zIndex:900, pointerEvents:"none", textAlign:"left", whiteSpace:"normal",
      display:"flex", gap:10, alignItems:"flex-start",
    }}>
      {INFO_ICON}
      <span style={{ minWidth:0 }}>
        {title && (
          <strong style={{ display:"block", color:"var(--accent)", fontWeight:700, marginBottom:3, fontSize:12.5, letterSpacing:"0.01em" }}>
            {title}
          </strong>
        )}
        <span style={{ display:"block", color:"var(--text-secondary)", fontSize:12.5, lineHeight:1.55, fontWeight:500, fontFamily:"var(--font-sans)" }}>
          {hint}
        </span>
      </span>
    </span>
  );
}

// Hook de hover/focus que calcula la posición del control al activarse.
function useHintRect() {
  const [rect, setRect] = useState<HintRect | null>(null);
  const ref = useRef<HTMLElement>(null);
  const open = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setRect({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  }, []);
  const close = useCallback(() => setRect(null), []);
  useEffect(() => {
    if (!rect) return;
    const h = () => close();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); };
  }, [rect, close]);
  return { rect, ref, open, close };
}

// Envuelve un control (botón, filtro, grupo) y revela un globo flotante al hacer hover/focus.
function HintZone({
  hint, title, children, style,
}: {
  hint: string; title?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const { rect, ref, open, close } = useHintRect();
  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      onMouseEnter={open}
      onMouseLeave={close}
      onMouseDown={close}
      onFocus={open}
      onBlur={e => { if (!ref.current?.contains(e.relatedTarget as Node)) close(); }}
      style={{
        display:"inline-flex", alignItems:"center", position:"relative", borderRadius:12,
        boxShadow: rect ? "0 0 0 3px rgba(var(--accent-rgb),0.20)" : "0 0 0 0 transparent",
        transition:"box-shadow 220ms var(--ease-premium)",
        ...style,
      }}
    >
      {children}
      {rect && <FloatingTip rect={rect} hint={hint} title={title} />}
    </span>
  );
}

// Etiqueta de campo (modales) que se subraya, se ilumina y muestra el globo al hacer hover/focus.
function HintLabel({
  children, hint, title, htmlFor, style,
}: {
  children: React.ReactNode; hint: string; title?: string; htmlFor?: string; style?: React.CSSProperties;
}) {
  const { rect, ref, open, close } = useHintRect();
  return (
    <label
      ref={ref as React.RefObject<HTMLLabelElement>}
      htmlFor={htmlFor}
      onMouseEnter={open}
      onMouseLeave={close}
      onMouseDown={close}
      style={{
        ...style, position:"relative", cursor:"help", width:"fit-content",
        textDecoration:"underline", textDecorationStyle:"dotted",
        textDecorationColor: rect ? "var(--accent)" : "rgba(var(--accent-rgb),0.45)",
        textUnderlineOffset:"3px",
        color: rect ? "var(--accent)" : (style?.color ?? "var(--text-secondary)"),
        transition:"color 180ms, text-decoration-color 180ms",
      }}
    >
      {children}
      {rect && <FloatingTip rect={rect} hint={hint} title={title} />}
    </label>
  );
}

// ── GlassBtn ──────────────────────────────────────────────────────────────────

function GlassBtn({
  onClick, children, accent, small, disabled,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-haspopup": ariaHaspopup,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  accent?: boolean;
  small?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "listbox" | "dialog" | "menu" | "true";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      className="ripple-effect hover-lift"
      style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
        height: small ? 32 : 36,
        padding: small ? "0 12px" : "0 16px",
        borderRadius:10,
        border: accent ? "1px solid var(--btn-primary-border)" : "1px solid var(--cal-border)",
        background: accent ? "var(--btn-primary-bg)" : "var(--btn-bg)",
        color: accent ? "var(--btn-primary-text)" : disabled ? "var(--text-muted)" : "var(--text-primary)",
        boxShadow: accent ? "var(--shadow-btn-primary)" : "var(--shadow-btn)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: small ? 13 : 14,
        fontFamily:"var(--font-sans)",
        fontWeight: accent ? 700 : 600,
        letterSpacing:"-0.01em",
        opacity: disabled ? 0.5 : 1,
        flexShrink:0,
        transition:"opacity 160ms, transform 240ms, box-shadow 240ms",
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.opacity = "0.9";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
      }}
    >
      {children}
    </button>
  );
}

// ── CountryDropdown ───────────────────────────────────────────────────────────

function CountryDropdown({ selected, onChange }: { selected: CountryKey; onChange: (k: CountryKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  const c = CMAP[selected];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <GlassBtn
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Filtrar por país: ${c.label}`}
      >
        <span style={{ fontSize:16 }}>{c.flag}</span>
        <span style={{ fontWeight:600 }}>{c.label}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity:0.55, transition:"transform 200ms", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </GlassBtn>

      {open && (
        <div
          role="listbox"
          aria-label="Seleccionar país"
          className="animate-fade-in glass"
          style={{
            position:"absolute", top:"calc(100% + 8px)", right:0,
            borderRadius:12, padding:5, zIndex:100, minWidth:170,
            boxShadow:"var(--shadow-dropdown)",
          }}
        >
          {COUNTRIES.map(co => (
            <button
              key={co.key}
              type="button"
              role="option"
              aria-selected={selected === co.key}
              onClick={() => { onChange(co.key); setOpen(false); }}
              style={{
                display:"flex", alignItems:"center", gap:10,
                width:"100%", padding:"9px 12px", border:"none", borderRadius:10,
                background: selected === co.key ? "var(--cal-cell-hover)" : "transparent",
                color: selected === co.key ? "var(--accent)" : "var(--text-primary)",
                cursor:"pointer", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:500, textAlign:"left",
                transition:"background 100ms",
              }}
              onMouseEnter={e => {
                if (selected !== co.key)
                  (e.currentTarget as HTMLElement).style.background = "var(--cal-cell-bg)";
              }}
              onMouseLeave={e => {
                if (selected !== co.key)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize:18 }}>{co.flag}</span>
              <span>{co.label}</span>
              {selected === co.key && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none" style={{ marginLeft:"auto" }}>
                  <path d="M1 5L4.5 8.5L11 1" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PeopleInput ───────────────────────────────────────────────────────────────

function PeopleInput({ people, onChange, knownPeople = PEOPLE, onAddNew }: {
  people: string[];
  onChange: (p: string[]) => void;
  knownPeople?: string[];
  onAddNew?: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = "people-input";

  useClickOutside(containerRef, useCallback(() => setOpen(false), []));

  const filtered = knownPeople.filter(p => p.toLowerCase().includes(query.toLowerCase()));

  function toggle(name: string) {
    onChange(people.includes(name) ? people.filter(x => x !== name) : [...people, name]);
  }
  function addCustom() {
    const n = query.trim();
    if (n && !people.includes(n)) {
      onChange([...people, n]);
      setQuery("");
      if (!knownPeople.includes(n)) onAddNew?.(n);
    }
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1px solid var(--cal-border)",
    background:"var(--cal-cell-bg)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
  };

  return (
    <div ref={containerRef} style={{ position:"relative" }}>
      {people.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
          {people.map(p => (
            <span key={p} style={{
              display:"inline-flex", alignItems:"center", gap:6,
              padding:"4px 8px 4px 10px", borderRadius:20,
              background:"var(--cal-cell-bg)",
              border:"1px solid var(--cal-border)",
              fontSize:13, fontWeight:500, color:"var(--text-primary)",
              boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {p}
              <button type="button" aria-label={`Quitar a ${p}`}
                onClick={() => onChange(people.filter(x => x !== p))}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:15, lineHeight:1, padding:0, display:"flex", alignItems:"center" }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <label htmlFor={inputId} style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>
        Buscar o añadir personas
      </label>
      <input
        id={inputId}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={e => {
          setOpen(true);
          (e.target as HTMLInputElement).style.borderColor = "var(--accent)";
          (e.target as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb),0.22)";
        }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); e.stopPropagation(); }
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length === 1) toggle(filtered[0]);
            else if (filtered.length === 0) addCustom();
          }
        }}
        placeholder={people.length === 0 ? "Buscar personas…" : "Añadir más…"}
        autoComplete="off"
        style={inputStyle}
        onBlur={e => {
          (e.target as HTMLInputElement).style.borderColor = "var(--cal-border)";
          (e.target as HTMLInputElement).style.boxShadow = "none";
        }}
      />

      {open && (
        <div className="animate-fade-in" style={{
          position:"absolute", top:"calc(100% + 5px)", left:0, right:0,
          borderRadius:12, zIndex:300, overflow:"hidden",
          background:"var(--menu-bg)",
          border:"1px solid var(--cal-border)",
          boxShadow:"var(--shadow-dropdown)",
        }}>
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"7px 8px 7px 14px", borderBottom:"1px solid var(--cal-border)",
            position:"sticky", top:0, background:"var(--menu-bg)", zIndex:1,
          }}>
            <span style={{ fontSize:11, color:"var(--text-muted)", letterSpacing:"0.03em", fontFamily:"var(--font-sans)" }}>
              {people.length} seleccionado{people.length === 1 ? "" : "s"}
            </span>
            <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(false); }}
              style={{
                height:28, padding:"0 16px", borderRadius:8,
                border:"1px solid var(--btn-primary-border)",
                background:"var(--btn-primary-bg)", color:"var(--btn-primary-text)",
                fontSize:12.5, fontWeight:700, fontFamily:"var(--font-sans)", cursor:"pointer",
                boxShadow:"var(--shadow-btn-primary)",
              }}>
              Listo
            </button>
          </div>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-sans)" }}>
                {query.trim()
                  ? <><span style={{ color:"var(--text-secondary)" }}>"{query.trim()}"</span> · Enter para añadir</>
                  : "Sin resultados"}
              </div>
            ) : filtered.map(p => {
              const sel = people.includes(p);
              return (
                <button key={p} type="button" role="option" aria-selected={sel}
                  onMouseDown={e => { e.preventDefault(); toggle(p); }}
                  style={{
                    display:"flex", alignItems:"center", gap:10,
                    width:"100%", padding:"9px 14px", border:"none", textAlign:"left",
                    background: sel ? "var(--cal-cell-hover)" : "transparent",
                    color: sel ? "var(--accent)" : "var(--text-primary)",
                    cursor:"pointer", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:500,
                    transition:"background 80ms",
                  }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--cal-cell-bg)"; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{
                    width:18, height:18, borderRadius:5, flexShrink:0,
                    border:`1.5px solid ${sel ? "var(--accent)" : "var(--cal-border)"}`,
                    background: sel ? "var(--accent)" : "var(--cal-cell-bg)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 80ms",
                  }}>
                    {sel && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="var(--accent-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DateRangePicker ───────────────────────────────────────────────────────────

function DateRangePicker({
  startDate, endDate, onChangeStart, onChangeEnd,
}: {
  startDate: string; endDate: string;
  onChangeStart: (d: string) => void; onChangeEnd: (d: string) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [picking,  setPicking]  = useState<"start" | "end">("start");
  const [calYear,  setCalYear]  = useState(() => new Date(startDate + "T12:00:00").getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date(startDate + "T12:00:00").getMonth());
  const [hovered,  setHovered]  = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setHovered(null); }, []);
  useClickOutside(ref, close);

  function openFor(mode: "start" | "end") {
    const d = new Date((mode === "start" ? startDate : endDate) + "T12:00:00");
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
    setPicking(mode); setOpen(true);
  }

  function selectDay(ds: string) {
    if (picking === "start") {
      onChangeStart(ds);
      if (ds > endDate) onChangeEnd(ds);
      setPicking("end");
    } else {
      if (ds < startDate) { onChangeStart(ds); onChangeEnd(startDate); }
      else onChangeEnd(ds);
      setOpen(false); setHovered(null);
    }
  }

  function prevCal() { if (calMonth===0) { setCalMonth(11); setCalYear(y=>y-1); } else setCalMonth(m=>m-1); }
  function nextCal() { if (calMonth===11) { setCalMonth(0); setCalYear(y=>y+1); } else setCalMonth(m=>m+1); }

  const grid   = getMonthGrid(calYear, calMonth);
  const effEnd = picking==="end" && hovered && hovered>=startDate ? hovered : endDate;
  const inMonth = (d: Date) => d.getMonth() === calMonth;

  const navBtnSt: React.CSSProperties = {
    width:30, height:30, borderRadius:8,
    border:"1px solid var(--cal-border)",
    background:"var(--cal-cell-bg)", color:"var(--text-secondary)",
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:16, transition:"opacity 100ms",
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Date strip */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr auto 1fr",
        alignItems:"stretch",
        border:"1px solid var(--cal-border)",
        borderRadius:12, overflow:"hidden",
        background:"var(--cal-cell-bg)",
        boxShadow:"none",
      }}>
        <button type="button" onClick={() => openFor("start")} style={{
          padding:"10px 14px", border:"none",
          background: open && picking==="start" ? "var(--accent-dim)" : "transparent",
          cursor:"pointer", textAlign:"left", outline:"none", transition:"background 150ms",
        }}>
          <div style={{ fontSize:10, letterSpacing:"0.02em", fontWeight:600,
            color: open && picking==="start" ? "var(--accent)" : "var(--text-secondary)", marginBottom:3 }}>Desde</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-sans)" }}>
            {formatDisplayDate(startDate)}
          </div>
        </button>

        <div style={{ display:"flex", alignItems:"center", padding:"0 8px",
          borderLeft:"1px solid var(--cal-border)", borderRight:"1px solid var(--cal-border)",
          color:"var(--text-muted)", pointerEvents:"none", fontSize:14 }}>→</div>

        <button type="button" onClick={() => openFor("end")} style={{
          padding:"10px 14px", border:"none",
          background: open && picking==="end" ? "var(--accent-dim)" : "transparent",
          cursor:"pointer", textAlign:"left", outline:"none", transition:"background 150ms",
        }}>
          <div style={{ fontSize:10, letterSpacing:"0.02em", fontWeight:600,
            color: open && picking==="end" ? "var(--accent)" : "var(--text-secondary)", marginBottom:3 }}>Hasta</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-sans)" }}>
            {formatDisplayDate(endDate)}
          </div>
        </button>
      </div>

      {/* Calendar popup */}
      {open && (
        <div className="animate-fade-in" onClick={e => e.stopPropagation()} style={{
          position:"absolute", top:"calc(100% + 8px)", left:0,
          width:288, zIndex:400,
          borderRadius:12,
          border:"1px solid var(--cal-border)",
          background:"var(--menu-bg)",
          boxShadow:"var(--shadow-dropdown)",
          overflow:"hidden",
        }}>
          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"12px 14px 8px", borderBottom:"1px solid var(--cal-border)" }}>
            <button type="button" onClick={prevCal} aria-label="Mes anterior" style={navBtnSt}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
            >‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", fontFamily:"var(--font-sans)" }}>
              {MONTHS_FULL[calMonth]} {calYear}
            </span>
            <button type="button" onClick={nextCal} aria-label="Mes siguiente" style={navBtnSt}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
            >›</button>
          </div>

          {/* Day labels */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"8px 10px 2px" }}>
            {["D","L","M","M","J","V","S"].map((d,i) => (
              <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700,
                color:"var(--text-muted)", letterSpacing:"0.06em" }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ padding:"0 10px 10px" }}>
            {grid.map((week, wi) => (
              <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
                {week.map((day, di) => {
                  const ds      = toDateStr(day);
                  const isStart = ds === startDate;
                  const isEnd   = ds === effEnd;
                  const inRange = ds > startDate && ds < effEnd;
                  const isSel   = isStart || isEnd;
                  const isHov   = ds === hovered && !isSel;
                  const single  = startDate === effEnd;

                  let radius = "50%";
                  if (single && isSel) radius = "50%";
                  else if (isStart) radius = "50% 0 0 50%";
                  else if (isEnd)   radius = "0 50% 50% 0";
                  else if (inRange) radius = "0";

                  return (
                    <div key={di} style={{
                      background: inRange ? "var(--accent-dim)" : "transparent",
                      padding:"2px 0",
                    }}>
                      <button type="button"
                        onMouseDown={e => { e.preventDefault(); selectDay(ds); }}
                        onMouseEnter={() => setHovered(ds)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          width:"100%", height:30, border:"none",
                          cursor:"pointer", fontSize:12, fontFamily:"var(--font-sans)",
                          fontWeight: isSel ? 700 : 400, borderRadius:radius,
                          background: isSel ? "var(--accent)" : isHov ? "var(--cal-cell-hover)" : "transparent",
                          color: isSel ? "var(--accent-text)" : inMonth(day) ? "var(--text-primary)" : "var(--text-muted)",
                          opacity: inMonth(day) ? 1 : 0.55,
                          transition:"background 80ms",
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Hint */}
          <div style={{
            padding:"8px 14px", textAlign:"center",
            borderTop:"1px solid var(--cal-border)",
            fontSize:11, fontWeight:600, letterSpacing:"0.04em",
            color:"var(--accent)", fontFamily:"var(--font-sans)",
          }}>
            {picking === "start" ? "Elige la fecha de inicio y luego la final" : "Ahora elige la fecha final"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PublicationModal ──────────────────────────────────────────────────────────

function PublicationModal({ state, dark, onSave, onDelete, onClose, onEdit, onGoToCreate, knownPeople = PEOPLE, onAddPerson }: {
  state: Exclude<ModalState, { mode: "closed" }>;
  dark: boolean;
  onSave: (p: Publication) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onEdit: (pub: Publication) => void;
  onGoToCreate: (pubId: string) => void;
  knownPeople?: string[];
  onAddPerson?: (name: string) => void;
}) {
  const isCreate = state.mode === "create";
  const isView   = state.mode === "view";
  const isEdit   = state.mode === "edit";
  const existing = (isView || isEdit) ? (state as { pub: Publication }).pub : undefined;

  const [title,   setTitle]   = useState(existing?.title     ?? "");
  const [content, setContent] = useState(existing?.content   ?? "");
  const [sDate,   setSDate]   = useState(existing?.startDate ?? (state as { date?: string }).date ?? toDateStr(TODAY));
  const [eDate,   setEDate]   = useState(existing?.endDate   ?? (state as { date?: string }).date ?? toDateStr(TODAY));
  const [country, setCountry] = useState<CountryKey>(existing?.country ?? "LATAM");
  const [category, setCategory] = useState<ProductCategory>(existing?.category ?? "Digital Identity");
  const [people,  setPeople]  = useState<string[]>(existing?.people ?? []);
  const [copied,  setCopied]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const c = CMAP[country];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function handleSave() {
    if (!title.trim()) return;
    onSave({ id: existing?.id ?? uid(), title: title.trim(), content, startDate: sDate, endDate: eDate < sDate ? sDate : eDate, country, category, people });
    onClose();
  }

  async function handlePostLinkedIn() {
    const text = content || title;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch (_) {}
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1px solid var(--cal-border)",
    background:"var(--cal-cell-bg)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
  };

  const labelStyle: React.CSSProperties = {
    display:"block", marginBottom:6, fontSize:12,
    fontFamily:"var(--font-sans)", fontWeight:500,
    letterSpacing:"0.01em",
    color:"var(--text-secondary)",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--accent)";
    (e.target as HTMLElement).style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb),0.22)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--cal-border)";
    (e.target as HTMLElement).style.boxShadow = "none";
  };

  return (
    <div className="animate-backdrop" onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:200,
      background:"var(--cal-modal-overlay)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:20,
      backdropFilter:"blur(8px)",
      WebkitBackdropFilter:"blur(8px)",
    }}>
      <div
        role="dialog" aria-modal="true"
        aria-label={isCreate ? "Nueva publicación" : isEdit ? "Editar publicación" : existing?.title}
        className="animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          width:"100%", maxWidth:500,
          borderRadius:20,
          border:"1px solid var(--cal-border)",
          background:"var(--modal-bg)",
          boxShadow:"var(--shadow-modal)",
          overflowY:"auto",
          overflowX:"hidden",
          maxHeight:"calc(100vh - 40px)",
        }}
      >
        {/* Country accent bar */}
        <div style={{ height:5, background: dark ? c.colorDark : c.color, width:"100%", opacity:0.85 }} />

        {/* Header */}
        <div style={{ padding:"20px 24px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            {isView ? (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:20 }}>{c.flag}</span>
                  <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--text-secondary)" }}>
                    {c.label}
                  </span>
                  <span style={{ color:"var(--text-muted)" }}>·</span>
                  <span style={{ fontSize:13, color:"var(--text-muted)" }}>
                    {existing?.startDate === existing?.endDate
                      ? formatDisplayDate(existing!.startDate)
                      : `${formatDisplayDate(existing!.startDate)} → ${formatDisplayDate(existing!.endDate)}`}
                  </span>
                </div>
                <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.02em", color:"var(--text-primary)", lineHeight:1.3 }}>
                  {existing?.title}
                </h2>
                {existing?.people && existing.people.length > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12, flexWrap:"wrap" }}>
                    {existing.people.map((p, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <PersonBadge name={p} size={24} />
                        <span style={{ fontSize:13, fontWeight:500, color:"var(--text-secondary)" }}>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <IconTile size={34}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18M8 2v4M16 2v4M12 13.5v5M9.5 16h5"/>
                  </svg>
                </IconTile>
                <h2 style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text-primary)" }}>
                  {isCreate ? "Nueva publicación" : "Editar publicación"}
                </h2>
              </div>
            )}
          </div>

          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="hover-lift"
            style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              width:32, height:32, borderRadius:8,
              background:"var(--cal-cell-bg)",
              border:"1px solid var(--cal-border)",
              color:"var(--text-muted)", cursor:"pointer", fontSize:16, lineHeight:1,
              boxShadow:"var(--shadow-btn)", transition:"all 200ms", flexShrink:0,
            }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:"18px 24px 0" }}>
          {isView ? (
            <div style={{
              padding:"16px", borderRadius:12,
              background:"var(--cal-section-bg)",
              border:"1px solid var(--cal-border)",
              fontSize:14, fontWeight:400, lineHeight:1.75, color:"var(--text-primary)",
              whiteSpace:"pre-wrap", maxHeight:200, overflowY:"auto",
            }}>
              {existing?.content || (
                <span style={{ color:"var(--text-muted)", fontStyle:"italic" }}>
                  Sin contenido — haz clic en "Generar post" para crear un borrador.
                </span>
              )}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <HintLabel htmlFor="pub-title" style={labelStyle}
                  title="Título"
                  hint="Identifica la publicación dentro del calendario. No se publica en LinkedIn; es solo para que tú la reconozcas.">
                  Título
                </HintLabel>
                <input id="pub-title" style={inputStyle} value={title}
                  onChange={e => setTitle(e.target.value)} placeholder="Título del post…"
                  autoFocus onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"end" }}>
                <div>
                  <HintLabel style={labelStyle}
                    title="Fechas"
                    hint="Define el rango en que va la publicación. Puede ser un solo día o varios; en el calendario se ve como una barra que abarca esos días.">
                    Fechas
                  </HintLabel>
                  <DateRangePicker
                    startDate={sDate} endDate={eDate}
                    onChangeStart={setSDate} onChangeEnd={setEDate}
                  />
                </div>
                <div>
                  <HintLabel htmlFor="pub-country" style={labelStyle}
                    title="País / mercado"
                    hint="El mercado de la publicación. Define la bandera y el color en el calendario, y orienta la búsqueda de perfiles ICP en Apollo.">
                    País
                  </HintLabel>
                  <select id="pub-country" style={{ ...inputStyle, cursor:"pointer", minWidth:130 }} value={country}
                    onChange={e => setCountry(e.target.value as CountryKey)}
                    onFocus={onFocus} onBlur={onBlur}>
                    {COUNTRIES.map(co => (
                      <option key={co.key} value={co.key}>{co.flag} {co.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <HintLabel htmlFor="pub-category" style={labelStyle}
                  title="Producto (ICP)"
                  hint="El producto de Truora que promueve el post. Con él y el país se buscan los perfiles de cliente ideal en Apollo cuando guardas la tarjeta.">
                  Producto
                </HintLabel>
                <select id="pub-category" style={{ ...inputStyle, cursor:"pointer" }} value={category}
                  onChange={e => setCategory(e.target.value as ProductCategory)}
                  onFocus={onFocus} onBlur={onBlur}>
                  {PRODUCT_CATEGORIES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <HintLabel style={labelStyle}
                  title="Personas"
                  hint="Quiénes firman o aparecen en la publicación. Se muestran como avatares en la tarjeta del calendario. Puedes elegir de la lista o añadir a alguien nuevo.">
                  Personas
                </HintLabel>
                <PeopleInput people={people} onChange={setPeople} knownPeople={knownPeople} onAddNew={onAddPerson} />
              </div>

              <div>
                <HintLabel htmlFor="pub-content" style={labelStyle}
                  title="Contenido de LinkedIn"
                  hint="El texto que se publicará en LinkedIn. Puedes escribirlo aquí, o generarlo con IA y el tono del autor desde la pestaña “Crea tu post”.">
                  Contenido de LinkedIn
                </HintLabel>
                <textarea id="pub-content"
                  style={{ ...inputStyle, minHeight:100, resize:"vertical", lineHeight:1.65 }}
                  value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Escribe aquí tu post de LinkedIn…" onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding:"18px 24px 22px", display:"flex", flexDirection:"column", gap:10 }}>
          {isView ? (
            <>
              <div style={{ display:"flex", gap:10 }}>
                <HintZone
                  style={{ flex:1 }}
                  title="Publicar en LinkedIn"
                  hint="Copia el contenido al portapapeles y abre LinkedIn en una pestaña nueva, listo para pegar y publicar.">
                <button type="button" onClick={handlePostLinkedIn}
                  className="ripple-effect hover-lift"
                  style={{
                    flex:1, height:42, borderRadius:12,
                    border:"1px solid rgba(255,255,255,0.28)",
                    background:"#0A66C2",
                    color:"#fff", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    cursor:"pointer",
                    boxShadow:"0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                    transition:"opacity 150ms, transform 240ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  {copied ? "¡Copiado! Pega en LinkedIn" : "Publicar en LinkedIn"}
                </button>
                </HintZone>

                <HintZone
                  style={{ flex:1 }}
                  title="Generar post con IA"
                  hint="Abre “Crea tu post” con esta tarjeta ya vinculada, para redactar el contenido con IA usando su país y enfoque.">
                <button type="button"
                  onClick={() => { onGoToCreate(existing!.id); }}
                  className="ripple-effect hover-lift"
                  style={{
                    flex:1, height:42, borderRadius:12,
                    border:"1px solid var(--cal-border)",
                    background:"var(--cal-cell-bg)",
                    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:600,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                    cursor:"pointer",
                    boxShadow:"var(--shadow-btn)", transition:"opacity 150ms, transform 240ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  ✦ Generar post
                </button>
                </HintZone>
              </div>

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button type="button"
                  onClick={() => { if (confirmDel) onDelete(existing!.id); else setConfirmDel(true); }}
                  className="ripple-effect"
                  aria-label={confirmDel ? "Confirmar eliminación" : `Eliminar publicación ${existing?.title ?? ""}`}
                  style={{
                    padding:"7px 14px", borderRadius:8, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600, cursor:"pointer",
                    border:"1px solid var(--status-error-line)",
                    background: confirmDel ? "var(--status-error)" : "var(--status-error-bg)",
                    color: confirmDel ? "#fff" : "var(--status-error)",
                    transition:"opacity 150ms, background 150ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  {confirmDel ? "¿Confirmar eliminación?" : "Eliminar"}
                </button>
                <button type="button" onClick={() => onEdit(existing!)}
                  className="ripple-effect hover-lift"
                  style={{
                    padding:"7px 16px", borderRadius:8, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600, cursor:"pointer",
                    border:"1px solid var(--cal-border)", background:"var(--cal-cell-bg)",
                    color:"var(--text-primary)",
                    boxShadow:"var(--shadow-btn)", transition:"opacity 150ms, transform 240ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  Editar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              {isEdit && existing ? (
                <button type="button"
                  onClick={() => { if (confirmDel) { onDelete(existing.id); onClose(); } else setConfirmDel(true); }}
                  className="ripple-effect"
                  aria-label={confirmDel ? "Confirmar eliminación" : `Eliminar publicación ${existing.title}`}
                  style={{
                    padding:"0 16px", height:36, borderRadius:10,
                    fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600, cursor:"pointer",
                    border:"1px solid var(--status-error-line)",
                    background: confirmDel ? "var(--status-error)" : "var(--status-error-bg)",
                    color: confirmDel ? "#fff" : "var(--status-error)",
                  }}
                >
                  {confirmDel ? "¿Confirmar eliminación?" : "Eliminar"}
                </button>
              ) : <div />}

              <div style={{ display:"flex", gap:8 }}>
                <GlassBtn onClick={onClose}>Cancelar</GlassBtn>
                <GlassBtn onClick={handleSave} accent disabled={!title.trim()}>
                  {isCreate ? "Agregar publicación" : "Guardar cambios"}
                </GlassBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ToneAdapterModal ──────────────────────────────────────────────────────────

function ToneAdapterModal({ onClose, initialPerson, people = PEOPLE, onSaved }: {
  onClose: () => void; initialPerson?: string; people?: string[]; onSaved?: (name: string) => void;
}) {
  const [person,  setPerson]  = useState(initialPerson ?? "");
  const [newName, setNewName] = useState("");
  const [url,     setUrl]     = useState("");
  const [sample,  setSample]  = useState("");
  const [saved,   setSaved]   = useState<ToneProfile | null>(null);
  const [status,  setStatus]  = useState<"idle"|"analyzing"|"done">("idle");
  const [cloud,   setCloud]   = useState<{ supabase: boolean; fileName: string } | null>(null);

  const effectiveName = person === "__new__" ? newName.trim() : person.trim();

  useEffect(() => {
    if (person === "__new__") {
      setSaved(null); setCloud(null); setUrl(""); setSample("");
      return;
    }
    if (person) {
      const p = loadToneProfile(person);
      setSaved(p); setCloud(null);
      if (p) { setUrl(p.linkedinUrl); setSample(p.sampleText); }
      else   { setUrl(""); setSample(""); }
    }
  }, [person]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleAnalyze() {
    if (!effectiveName || sample.trim().length < 30) return;
    setStatus("analyzing");
    const profile = analyzeTone(sample, effectiveName, url.trim());
    saveToneProfile(profile);
    try {
      const res = await fetch("/api/tone-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      setCloud(data.ok ? { supabase: !!data.supabase, fileName: data.fileName ?? "" } : { supabase: false, fileName: "" });
      // Persistió en la nube → que la persona aparezca y quede seleccionada de inmediato.
      if (data.ok && data.supabase) onSaved?.(effectiveName);
    } catch {
      setCloud({ supabase: false, fileName: "" });
    }
    setSaved(profile);
    setStatus("done");
  }

  const inputSt: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1px solid var(--cal-border)", background:"var(--cal-cell-bg)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
  };
  const labelSt: React.CSSProperties = {
    display:"block", marginBottom:6, fontSize:12,
    fontFamily:"var(--font-sans)", fontWeight:600,
    letterSpacing:"0.01em", color:"var(--text-secondary)",
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--accent)";
    (e.target as HTMLElement).style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb),0.18)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--cal-border)";
    (e.target as HTMLElement).style.boxShadow = "none";
  };

  const styleLabels: Record<string, string> = {
    conversacional:"Conversacional", inspiracional:"Inspiracional",
    educativo:"Educativo", profesional:"Profesional",
  };

  return (
    <div className="animate-backdrop" onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:300,
      background:"var(--cal-modal-overlay)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
    }}>
      <div className="animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="tone-modal-title" onClick={e=>e.stopPropagation()} style={{
        width:"100%", maxWidth:520,
        borderRadius:20, border:"1px solid var(--cal-border)",
        background:"var(--modal-bg)",
        boxShadow:"var(--shadow-modal)", overflow:"hidden",
      }}>
        {/* accent bar */}
        <div style={{ height:4, background:"var(--accent)", opacity:0.85 }} />

        {/* header */}
        <div style={{ padding:"20px 24px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <IconTile>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>
              </svg>
            </IconTile>
            <div>
              <h2 id="tone-modal-title" style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text-primary)" }}>
                Adaptar tono de escritura
              </h2>
              <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, lineHeight:1.5 }}>
                Pega posts reales de LinkedIn para que el generador aprenda tu estilo.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{
            width:32, height:32, borderRadius:8, border:"1px solid var(--cal-border)",
            background:"var(--cal-cell-bg)", color:"var(--text-muted)",
            cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0,
          }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding:"18px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          {/* person */}
          <div>
            <HintLabel style={labelSt}
              title="Persona"
              hint="Elige a quién pertenece este tono, o crea uno nuevo. El perfil queda asociado a esa persona para reutilizarlo al generar posts.">
              Persona
            </HintLabel>
            <select style={{ ...inputSt, cursor:"pointer" }} value={person}
              onChange={e=>setPerson(e.target.value)} onFocus={onFocus} onBlur={onBlur}>
              <option value="">Selecciona una persona…</option>
              {people.map(p=><option key={p} value={p}>{p}</option>)}
              <option value="__new__">＋ Crear tono nuevo…</option>
            </select>
            {person === "__new__" && (
              <input
                style={{ ...inputSt, marginTop:8 }}
                value={newName}
                onChange={e=>setNewName(e.target.value)}
                placeholder="Nombre y apellido de la persona…"
                aria-label="Nombre de la nueva persona"
                autoFocus
                onFocus={onFocus} onBlur={onBlur}
              />
            )}
          </div>

          {/* linkedin url */}
          <div>
            <HintLabel style={labelSt}
              title="URL de LinkedIn"
              hint="El perfil de la persona (opcional). Sirve como referencia y para abrir su LinkedIn rápido; no es obligatorio para analizar el tono.">
              URL de LinkedIn (opcional)
            </HintLabel>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inputSt, flex:1 }} value={url}
                onChange={e=>setUrl(e.target.value)}
                placeholder="https://linkedin.com/in/tu-perfil"
                onFocus={onFocus} onBlur={onBlur} />
              {url.trim() && (
                <button type="button"
                  onClick={()=>window.open(url.trim(),"_blank","noopener,noreferrer")}
                  style={{
                    height:42, padding:"0 14px", borderRadius:10, flexShrink:0,
                    border:"1px solid var(--linkedin-line)", background:"var(--linkedin-bg)",
                    color:"var(--linkedin)", fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600,
                    cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Ir a LinkedIn
                </button>
              )}
            </div>
          </div>

          {/* sample posts */}
          <div>
            <HintLabel style={labelSt}
              title="Posts de ejemplo"
              hint="Pega 3-5 publicaciones reales de la persona, separadas con ---. De aquí se aprende su estilo: emojis, hashtags, preguntas, listas y longitud típica.">
              Posts de LinkedIn{saved ? " (actualizar)" : ""}
            </HintLabel>
            <textarea style={{ ...inputSt, minHeight:160, resize:"vertical", lineHeight:1.65, fontSize:13 }}
              value={sample} onChange={e=>setSample(e.target.value)}
              placeholder={"Pega aquí 3-5 posts reales de LinkedIn.\nSepara cada post con ---\n\nEjemplo:\nMi primer post aquí...\n---\nOtro post aquí..."}
              onFocus={onFocus} onBlur={onBlur} />
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:5 }}>
              Separa cada post con <code style={{ background:"rgba(255,255,255,0.15)", padding:"1px 5px", borderRadius:4 }}>---</code> · Cuantos más posts, mejor el análisis
            </p>
          </div>

          {/* saved profile summary */}
          {saved && status !== "analyzing" && (
            <div style={{
              padding:"12px 14px", borderRadius:12,
              background:"rgba(var(--accent-rgb),0.08)",
              border:"1px solid rgba(var(--accent-rgb),0.22)",
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:8 }}>
                Tono guardado · {new Date(saved.updatedAt).toLocaleDateString("es-CO",{day:"numeric",month:"short"})}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {[
                  { label:`Estilo: ${styleLabels[saved.writingStyle]}`, show:true },
                  { label:"Emojis ✓",    show:saved.usesEmojis },
                  { label:"Hashtags ✓",  show:saved.usesHashtags },
                  { label:"Preguntas ✓", show:saved.usesQuestions },
                  { label:"Listas ✓",    show:saved.usesLists },
                  { label:`~${saved.avgWordsPerPost} palabras/post`, show:true },
                  { label: cloud?.supabase ? "Supabase ✓" : "Supabase pendiente", show: cloud !== null },
                  { label: cloud?.fileName ?? "", show: !!cloud?.fileName },
                ].filter(t=>t.show).map((t,i)=>(
                  <span key={i} style={{
                    padding:"3px 9px", borderRadius:20, fontSize:12, fontWeight:500,
                    background:"rgba(var(--accent-rgb),0.14)", color:"var(--accent)",
                    border:"1px solid rgba(var(--accent-rgb),0.20)",
                  }}>{t.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding:"0 24px 22px", display:"flex", gap:8, justifyContent:"flex-end" }}>
          <GlassBtn onClick={onClose}>Cancelar</GlassBtn>
          <GlassBtn accent disabled={!effectiveName || sample.trim().length < 30 || status === "analyzing"}
            onClick={handleAnalyze}>
            {status === "analyzing"
              ? "Analizando y guardando…"
              : status === "done"
              ? "✓ Guardado"
              : saved ? "Actualizar tono" : "Analizar y guardar"}
          </GlassBtn>
        </div>
      </div>
    </div>
  );
}

// ── PostCreator ───────────────────────────────────────────────────────────────

function autoConfigFromPub(pub: Publication): { focus: string; tone: string } {
  const text = (pub.title + " " + pub.content).toLowerCase();
  let focus = "Reconocimiento de marca";
  if (/tendencia|mercado|sector|ecosistema|industria/.test(text)) focus = "Liderazgo de pensamiento";
  else if (/tip|clave|aprend|guía|paso|cómo|estrategia/.test(text)) focus = "Educativo";
  else if (/anunci|lanzam|nuevo|present|estrena/.test(text)) focus = "Anuncio";
  else if (/historia|experiencia|aprendí|viaje|reflexi/.test(text)) focus = "Historia personal";
  else if (/startup|emprendim|ecosystem/.test(text)) focus = "Liderazgo de pensamiento";
  const toneMap: Partial<Record<CountryKey, string>> = { CO:"Conversacional", MX:"Conversacional", AR:"Directo" };
  return { focus, tone: toneMap[pub.country] ?? "Profesional" };
}

function pubDateLabel(pub: Publication): string {
  const s = new Date(pub.startDate + "T12:00:00");
  const e = new Date(pub.endDate   + "T12:00:00");
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((s.getTime() - now.getTime()) / 86400000);
  let when = diff < 0 ? `hace ${Math.abs(diff)}d` : diff === 0 ? "hoy" : diff === 1 ? "mañana" : `en ${diff}d`;
  if (pub.startDate !== pub.endDate) {
    when = `${s.toLocaleDateString("es",{day:"numeric",month:"short"})} → ${e.toLocaleDateString("es",{day:"numeric",month:"short"})}`;
  }
  return when;
}

// ── SavePostModal ─────────────────────────────────────────────────────────────

function SavePostModal({
  person, topic, preview, saveStatus, savedFile, onSave, onClose, people = PEOPLE,
}: {
  person: string;
  topic: string;
  people?: string[];
  preview: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  savedFile: string;
  onSave: (savePerson: string) => void;
  onClose: () => void;
}) {
  const [savePerson, setSavePerson] = useState(person);
  const previewText = preview.length > 300 ? preview.slice(0, 300).trimEnd() + "…" : preview;

  return (
    <div
      className="animate-backdrop"
      onClick={e => { if (e.target === e.currentTarget && saveStatus !== "saving") onClose(); }}
      style={{
        position:"fixed", inset:0, zIndex:500,
        background:"var(--cal-modal-overlay)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:24,
      }}
    >
      <div
        className="animate-slide-up glass-strong"
        role="dialog" aria-modal="true" aria-label="Guardar post"
        style={{
          width:"100%", maxWidth:480, borderRadius:20,
          padding:0, overflow:"hidden",
          boxShadow:"var(--shadow-modal)",
        }}
      >
        {/* header */}
        <div style={{
          padding:"20px 24px 18px",
          borderBottom:"1px solid var(--cal-border)",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <div style={{
            width:36, height:36, borderRadius:10, flexShrink:0,
            background:"var(--btn-bg)",
            border:"1px solid var(--cal-border)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"var(--shadow-btn)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", margin:0 }}>Guardar post</p>
            {topic && (
              <p style={{ fontSize:12, color:"var(--text-muted)", margin:"2px 0 0", fontWeight:500 }}>{topic}</p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={saveStatus==="saving"} aria-label="Cerrar"
            style={{
              width:30, height:30, borderRadius:8, border:"1px solid var(--cal-border)",
              background:"var(--cal-cell-bg)", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"var(--text-secondary)", transition:"background 150ms",
              opacity: saveStatus==="saving" ? 0.4 : 1,
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div style={{ padding:"20px 24px" }}>
          {/* person selector */}
          <HintLabel
            style={{ display:"block", marginBottom:6, fontSize:13, fontWeight:600, color:"var(--text-secondary)" }}
            title="¿Para quién es?"
            hint="Si eliges una persona, el post se archiva en su historial de borradores. “Solo guardar” lo guarda sin asociarlo a nadie.">
            ¿Para quién es este post?
          </HintLabel>
          <select
            value={savePerson}
            onChange={e => setSavePerson(e.target.value)}
            disabled={saveStatus !== "idle"}
            style={{
              width:"100%", padding:"11px 14px", borderRadius:10, marginBottom:16,
              border:"1px solid var(--cal-border)",
              background:"var(--cal-urlbar-bg)",
              color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
              fontWeight:500, cursor:"pointer", outline:"none",
            }}
          >
            <option value="">Solo guardar (sin perfil)</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* preview */}
          <HintLabel
            style={{ display:"block", marginBottom:6, fontSize:13, fontWeight:600, color:"var(--text-secondary)" }}
            title="Vista previa"
            hint="Un adelanto del texto que se va a guardar (recortado). Así confirmas el contenido antes de archivarlo.">
            Vista previa
          </HintLabel>
          <div style={{
            padding:"14px 16px", borderRadius:12, marginBottom:20,
            background:"var(--cal-section-bg)",
            border:"1px solid var(--cal-border)",
            fontSize:13, color:"var(--text-secondary)", lineHeight:1.7,
            fontFamily:"var(--font-sans)", fontWeight:450,
            maxHeight:140, overflowY:"auto",
            whiteSpace:"pre-wrap", wordBreak:"break-word",
          }}>
            {previewText}
          </div>

          {/* status / actions */}
          {saveStatus === "saved" ? (
            <div style={{
              display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
              borderRadius:12, background:"var(--status-success-bg)",
              border:"1px solid var(--status-success-line)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <p style={{ fontSize:13, fontWeight:700, color:"var(--status-success)", margin:0 }}>Post guardado</p>
                {savedFile && (
                  <p style={{ fontSize:11, color:"var(--status-success)", opacity:0.78, margin:"2px 0 0", fontWeight:500 }}>{savedFile}</p>
                )}
              </div>
            </div>
          ) : saveStatus === "error" ? (
            <div style={{
              display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
              borderRadius:12, background:"var(--status-error-bg)",
              border:"1px solid var(--status-error-line)",
              marginBottom:12,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ fontSize:13, fontWeight:600, color:"var(--status-error)", margin:0 }}>No se pudo guardar. Intenta de nuevo.</p>
            </div>
          ) : (
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onClose}
                style={{
                  flex:1, height:44, borderRadius:10,
                  border:"1px solid var(--cal-border)",
                  background:"var(--cal-cell-bg)",
                  color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
                  fontWeight:600, cursor:"pointer",
                }}>
                Cancelar
              </button>
              <button type="button"
                onClick={() => onSave(savePerson)}
                disabled={saveStatus === "saving"}
                style={{
                  flex:2, height:44, borderRadius:10,
                  border:"1px solid var(--btn-primary-border)",
                  background:"var(--btn-primary-bg)", color:"var(--btn-primary-text)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: saveStatus === "saving" ? "wait" : "pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  boxShadow:"var(--shadow-btn-primary)",
                  opacity: saveStatus === "saving" ? 0.75 : 1,
                  transition:"opacity 180ms",
                }}>
                {saveStatus === "saving" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="7"/>
                    </svg>
                    Guardando…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Guardar en perfil
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suggested accounts (ICP → Apollo) ─────────────────────────────────────────

// Infiere el producto/ICP a partir del contenido del post.
// Solo es el respaldo para tarjetas viejas sin categoría: las nuevas la traen seleccionada desde el card.
function inferProduct(text: string): ProductCategory {
  const t = (text || "").toLowerCase();
  if (/background|antecedent/.test(t)) return "Background Checks";
  if (/fraude|fraud|anti.?fraud|estafa/.test(t)) return "Fraude";
  if (/firma digital|firma electr|e-?sign|signature/.test(t)) return "Firma Digital";
  if (/agentic|agente|\bagent\b|chatbot|\bbot\b/.test(t)) return "WA Agentic";
  if (/banking|banca|wallet|billetera|cuenta/.test(t)) return "WA Banking";
  if (/onboarding|registro|alta de usuario/.test(t)) return "WA Onboarding";
  return "Digital Identity";
}

type SuggestedAccount = { apolloId: string; name: string; title: string; company: string; linkedinUrl?: string | null; linkedinSearchUrl: string };

function SuggestedAccountsModal({ category, country, publicationId, onChangeCategory, onClose }: {
  category: string;
  country: CountryKey;
  publicationId: string;
  onChangeCategory: (c: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<SuggestedAccount[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    fetch("/api/suggest-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, country, publicationId, limit: 10 }),
    })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        if (Array.isArray(d.suggestions)) setAccounts(d.suggestions);
        else setError(d.error || "No se encontraron perfiles.");
      })
      .catch(() => { if (alive) setError("No se pudo consultar Apollo."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [category, country, publicationId]);

  const flag = CMAP[country]?.flag ?? "🌎";
  const countryLabel = CMAP[country]?.label ?? country;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:700,
      background:"rgba(0,0,0,0.55)", backdropFilter:"blur(3px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%", maxWidth:560, maxHeight:"86vh", display:"flex", flexDirection:"column",
        borderRadius:16, overflow:"hidden",
        background:"var(--cal-window-bg)", border:"1px solid var(--cal-border)",
        boxShadow:"var(--shadow-window)",
      }}>
        {/* header */}
        <div style={{
          padding:"18px 22px", borderBottom:"1px solid var(--cal-border)",
          background:"var(--cal-header-bg)", flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", flex:1, letterSpacing:"-0.01em" }}>
              Perfiles para seguir <span style={{ fontSize:20, marginLeft:2 }}>{flag}</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{
              width:30, height:30, borderRadius:8, border:"1px solid var(--cal-border)",
              background:"var(--cal-cell-bg)", color:"var(--text-secondary)", cursor:"pointer",
              fontSize:16, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center",
            }}>×</button>
          </div>
          <p style={{ margin:"6px 0 12px", fontSize:12.5, color:"var(--text-secondary)", fontWeight:500 }}>
            ICP según el tema del post · País: <strong>{countryLabel}</strong> · vía Apollo (sin créditos)
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <HintLabel htmlFor="sg-cat" style={{ fontSize:12, fontWeight:700, color:"var(--text-primary)" }}
              title="Tema / producto ICP"
              hint="Cambia el producto para ajustar a qué cliente ideal apuntan los perfiles sugeridos. Apollo se vuelve a consultar al cambiarlo (sin gastar créditos).">
              Tema
            </HintLabel>
            <select id="sg-cat" value={category} onChange={e=>onChangeCategory(e.target.value)} style={{
              flex:1, padding:"9px 12px", borderRadius:9, cursor:"pointer",
              border:"1px solid var(--cal-border)", background:"var(--cal-urlbar-bg)",
              color:"var(--text-primary)", fontSize:13, fontWeight:600, fontFamily:"var(--font-sans)", outline:"none",
            }}>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* body */}
        <div style={{ overflowY:"auto", padding:"8px 0" }}>
          {loading && (
            <div style={{ padding:"40px 22px", textAlign:"center", color:"var(--text-secondary)", fontSize:13, fontWeight:500 }}>
              Buscando perfiles en Apollo…
            </div>
          )}
          {!loading && error && (
            <div style={{ padding:"30px 22px", textAlign:"center", color:"var(--status-error)", fontSize:13, fontWeight:600 }}>
              {error}
            </div>
          )}
          {!loading && !error && accounts.length === 0 && (
            <div style={{ padding:"30px 22px", textAlign:"center", color:"var(--text-secondary)", fontSize:13 }}>
              No se encontraron perfiles para este tema y país.
            </div>
          )}
          {!loading && !error && accounts.length > 0 && (
            <p style={{ margin:"0 22px 10px", fontSize:11.5, color:"var(--text-muted)", fontWeight:500, lineHeight:1.45 }}>
              💡 El botón abre el <strong>perfil de LinkedIn</strong> de la persona (o la búsqueda con su nombre si aún no está resuelto).
            </p>
          )}
          {!loading && !error && accounts.map((a, i) => (
            <div key={a.apolloId || i} style={{
              display:"flex", alignItems:"center", gap:12, padding:"11px 22px",
              borderBottom:"1px solid var(--cal-border)",
            }}>
              <div style={{
                width:34, height:34, flexShrink:0, borderRadius:"50%",
                background:"var(--btn-bg)", border:"1px solid var(--cal-border)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:700, color:"var(--text-secondary)",
              }}>{(a.name || "?").slice(0,1).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{a.name}</div>
                <div style={{ fontSize:12, color:"var(--text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {a.title} · {a.company}
                </div>
              </div>
              <a href={a.linkedinUrl || a.linkedinSearchUrl} target="_blank" rel="noopener noreferrer"
                title={a.linkedinUrl ? `Abrir el perfil de ${a.name}` : `Buscar a ${a.name} en LinkedIn`} style={{
                flexShrink:0, height:34, padding:"0 14px", borderRadius:9,
                border:"1px solid var(--linkedin-line)", background:"var(--linkedin-bg)", color:"var(--linkedin)",
                fontSize:12.5, fontWeight:700, fontFamily:"var(--font-sans)", textDecoration:"none",
                display:"flex", alignItems:"center", gap:6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PostCreator ───────────────────────────────────────────────────────────────

export function PostCreator({ dark, pubs, initialPubId, extraPeople = [] }: { dark: boolean; pubs: Publication[]; initialPubId?: string; extraPeople?: string[] }) {
  const [selectedPubId, setSelectedPubId] = useState(initialPubId ?? "");
  const [country,  setCountry]  = useState<CountryKey>("LATAM");
  const [topic,    setTopic]    = useState("");
  const [language, setLanguage] = useState("Español");
  const [tone,     setTone]     = useState("Profesional");
  const [focus,    setFocus]    = useState("Reconocimiento de marca");
  const [length,   setLength]   = useState("Medio (3-4 párrafos)");
  const [person,   setPerson]   = useState("");
  const [profile,  setProfile]  = useState<ToneProfile | null>(null);
  const [generated,setGenerated]= useState("");
  const [isGen,    setIsGen]    = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [showSuggest,     setShowSuggest]     = useState(false);
  const [suggestCategory, setSuggestCategory] = useState<string>("Digital Identity");
  const [showTone,    setShowTone]    = useState(false);
  const [showSave,    setShowSave]    = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [savedFile,   setSavedFile]   = useState("");
  const [genMode,      setGenMode]      = useState<""|"ai"|"local">("");
  const [profileFiles,  setProfileFiles]  = useState<string[]>([]);
  const [profilePeople, setProfilePeople] = useState<Array<{ name: string; fileName: string }>>([]);
  const [fileProfileMap, setFileProfileMap] = useState<Record<string, { fileName: string; style: string | null } | null>>({});

  // Sort pubs by proximity to today
  const sortedPubs = useMemo(() => [...pubs].sort((a,b) => a.startDate.localeCompare(b.startDate)), [pubs]);

  useEffect(() => {
    const p = person ? loadToneProfile(person) : null;
    setProfile(p);
  }, [person, showTone]);

  // Personas con perfil de tono (archivos + Supabase). Reutilizable para refrescar al instante.
  const refreshProfiles = useCallback(() => {
    return fetch("/api/tone-profile")
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.files)) setProfileFiles(d.files);
        if (d.ok && Array.isArray(d.people)) {
          setProfilePeople(d.people.filter((p: { name: string }) => p.name));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshProfiles(); }, [showTone, refreshProfiles]);

  // Al guardar un tono → mostrar y seleccionar la persona de inmediato (sin recargar).
  const handleToneSaved = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setProfilePeople(prev =>
      prev.some(p => samePerson(p.name, clean)) ? prev : [...prev, { name: clean, fileName: "" }]
    );
    setFileProfileMap(m => { const { [clean]: _drop, ...rest } = m; return rest; });
    setPerson(clean);
    refreshProfiles();
  }, [refreshProfiles]);

  // Selected person → load their documented tone profile (cached per person)
  useEffect(() => {
    if (!person || fileProfileMap[person] !== undefined) return;
    let alive = true;
    fetch(`/api/tone-profile?person=${encodeURIComponent(person)}`)
      .then(r => r.json())
      .then(d => { if (alive) setFileProfileMap(m => ({ ...m, [person]: d.ok && d.found ? { fileName: d.fileName, style: d.style ?? null } : null })); })
      .catch(() => { if (alive) setFileProfileMap(m => ({ ...m, [person]: null })); });
    return () => { alive = false; };
  }, [person, fileProfileMap]);

  const fileProfile = person ? fileProfileMap[person] ?? null : null;

  // PEOPLE + custom people + anyone with a tone profile that isn't already listed
  const allPeople = useMemo(() => {
    const fromProfiles = profilePeople
      .filter(({ name, fileName }) => !PEOPLE.some(p => samePerson(p, name) || fileMatchesPerson(fileName, p)))
      .map(p => p.name);
    return [...new Set([...PEOPLE, ...extraPeople, ...fromProfiles])];
  }, [profilePeople, extraPeople]);

  // When a calendar pub is selected → auto-fill topic + configure post type
  useEffect(() => {
    if (!selectedPubId) return;
    const pub = pubs.find(p => p.id === selectedPubId);
    if (!pub) return;
    setCountry(pub.country);
    setTopic(pub.content ? pub.content : pub.title);
    const auto = autoConfigFromPub(pub);
    setFocus(auto.focus);
    if (!profile) setTone(auto.tone);
  }, [selectedPubId, pubs, profile]);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setIsGen(true);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, focus, length, profile, language, personName: person || null }),
      });
      const data = await res.json();
      if (data.ok && data.content) {
        setGenerated(data.content);
        setGenMode("ai");
      } else {
        // Fallback to local generation if API fails
        setGenerated(buildGeneratedPost(topic, tone, focus, length, profile));
        setGenMode("local");
      }
    } catch {
      setGenerated(buildGeneratedPost(topic, tone, focus, length, profile));
      setGenMode("local");
    } finally {
      setIsGen(false);
      // Al generar el post → sugerir perfiles ICP (producto de la tarjeta del calendario;
      // si la tarjeta es vieja y no lo tiene, se infiere del contenido)
      const pub = pubs.find(p => p.id === selectedPubId);
      setSuggestCategory(pub?.category ?? inferProduct(topic));
      setShowSuggest(true);
    }
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(generated); setCopied(true); setTimeout(()=>setCopied(false),3000); } catch {}
  }

  async function handlePostLinkedIn() {
    await handleCopy();
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(generated)}`, "_blank", "noopener,noreferrer");
  }

  async function handleSavePost(savePerson: string) {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/save-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: savePerson || null,
          content: generated,
          topic: cleanTopic,
          date: new Date().toLocaleDateString("es-CO", { day:"numeric", month:"long", year:"numeric" }),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus("saved");
        setSavedFile(data.savedTo ?? "");
        setTimeout(() => { setSaveStatus("idle"); setShowSave(false); }, 2800);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const cleanTopic = topic.split("\n")[0].trim();

  // Input style — uses CSS token so dark mode works without JS
  const inputSt: React.CSSProperties = {
    width:"100%", padding:"13px 16px", borderRadius:10,
    border:"1px solid var(--cal-border)",
    background:"var(--cal-urlbar-bg)",
    color:"var(--text-primary)", fontSize:15, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
    fontWeight:500, lineHeight:1.5,
  };
  const labelSt: React.CSSProperties = {
    display:"block", marginBottom:9, fontSize:13,
    fontFamily:"var(--font-sans)", fontWeight:700,
    letterSpacing:"0.01em", color:"var(--text-primary)",
  };
  const onFocusFn = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--accent)";
    (e.target as HTMLElement).style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb),0.18)";
  };
  const onBlurFn = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = "var(--cal-border)";
    (e.target as HTMLElement).style.boxShadow = "none";
  };

  const selectedPub = pubs.find(p => p.id === selectedPubId);

  return (
    <>
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"minmax(480px, 44%) 1fr", overflow:"hidden" }}>

        {/* ── LEFT: Config ── */}
        <div style={{
          borderRight:"1px solid var(--cal-border)",
          overflowY:"auto", padding:"32px 36px 48px",
          display:"flex", flexDirection:"column", gap:24,
          background:"var(--cal-toolbar-bg)",
        }}>

          {/* ── STEP 1: Calendar link ── */}
          <HelpCard
            title="Vincular al calendario"
            hint="Conecta este post con una tarjeta ya programada. Así el país y el enfoque del mensaje se autocompletan según lo que planificaste, y el post queda asociado a esa fecha."
          >
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <IconTile>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </IconTile>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Relacionar con el calendario
              </span>
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-muted)", fontWeight:500 }}>opcional</span>
            </div>
            <select
              style={{ ...inputSt, cursor:"pointer" }}
              value={selectedPubId}
              onChange={e => { setSelectedPubId(e.target.value); if (!e.target.value) setTopic(""); }}
              onFocus={onFocusFn} onBlur={onBlurFn}
            >
              <option value="">— Sin vincular al calendario —</option>
              {sortedPubs.map(pub => {
                const c = CMAP[pub.country];
                return (
                  <option key={pub.id} value={pub.id}>
                    {c.flag}  {pub.title}  ·  {pubDateLabel(pub)}
                  </option>
                );
              })}
            </select>
            {selectedPub && (
              <div style={{
                marginTop:10, padding:"10px 12px", borderRadius:10,
                background:"rgba(var(--accent-rgb),0.08)",
                border:"1px solid rgba(var(--accent-rgb),0.20)",
                display:"flex", alignItems:"center", gap:10,
              }}>
                <span style={{ fontSize:20 }}>{CMAP[selectedPub.country].flag}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {selectedPub.title}
                  </div>
                  <div style={{ fontSize:11, color:"var(--accent)", fontWeight:600, marginTop:2 }}>
                    {CMAP[selectedPub.country].label} · {pubDateLabel(selectedPub)} · Enfoque auto: {autoConfigFromPub(selectedPub).focus}
                  </div>
                </div>
              </div>
            )}
          </HelpCard>

          {/* ── STEP 2: Topic ── */}
          <HelpCard
            title="Tema del post"
            hint="Resume en una frase de qué trata la publicación. Es la base que la IA usa para redactar el borrador, así que entre más claro el tema, mejor el resultado."
          >
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <IconTile>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </IconTile>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Describe el tema
              </span>
            </div>
            <textarea
              rows={3}
              style={{ ...inputSt, resize:"vertical", lineHeight:1.65 }}
              value={topic} onChange={e=>setTopic(e.target.value)}
              placeholder="Ej: El crecimiento de fintech en Colombia durante el primer trimestre de 2026…"
              onFocus={onFocusFn} onBlur={onBlurFn}
            />
          </HelpCard>

          {/* ── STEP 3: Config ── */}
          <HelpCard
            title="Estilo del contenido"
            hint="Define idioma, extensión, tono y enfoque del mensaje. La IA adapta el borrador a estas opciones. Si eliges un autor con tono personal, el tono lo define su perfil."
            contentStyle={{ display:"flex", flexDirection:"column", gap:20 }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <IconTile>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/>
                  <line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/>
                  <line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/>
                  <line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>
                </svg>
              </IconTile>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Ajusta el estilo
              </span>
            </div>

            {/* país (mercado / ICP) */}
            <div>
              <label style={{ ...labelSt, display:"flex", alignItems:"center", gap:6 }}>
                País del mercado
                {selectedPub
                  ? <span style={{ fontSize:10, fontWeight:600, color:"#059669", background:"rgba(5,150,105,0.10)", padding:"1px 7px", borderRadius:20, letterSpacing:"0.04em" }}>auto del calendario</span>
                  : <span style={{ fontSize:10, fontWeight:600, color:"var(--accent)", background:"rgba(var(--accent-rgb),0.12)", padding:"1px 7px", borderRadius:20, letterSpacing:"0.04em" }}>define los contactos ICP</span>}
              </label>
              <select
                style={{ ...inputSt, cursor: selectedPub ? "not-allowed" : "pointer", opacity: selectedPub ? 0.7 : 1 }}
                value={country}
                disabled={!!selectedPub}
                onChange={e=>setCountry(e.target.value as CountryKey)}
                onFocus={onFocusFn} onBlur={onBlurFn}>
                {COUNTRIES.map(c=><option key={c.key} value={c.key}>{c.flag}  {c.label}</option>)}
              </select>
            </div>

            {/* row: idioma + extensión */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <label style={labelSt}>Idioma</label>
                <select style={{ ...inputSt, cursor:"pointer" }} value={language}
                  onChange={e=>setLanguage(e.target.value)} onFocus={onFocusFn} onBlur={onBlurFn}>
                  {LANG_OPTIONS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Extensión</label>
                <select style={{ ...inputSt, cursor:"pointer" }} value={length}
                  onChange={e=>setLength(e.target.value)} onFocus={onFocusFn} onBlur={onBlurFn}>
                  {LENGTH_OPTIONS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* tono */}
            <div>
              <label style={{ ...labelSt, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                Tono
                {(fileProfile || profile) && person && <span style={{ fontSize:11, fontWeight:600, color:"var(--accent)", background:"rgba(var(--accent-rgb),0.12)", padding:"2px 8px", borderRadius:20 }}>lo define el perfil de {person.split(" ")[0]}</span>}
              </label>
              <select style={{ ...inputSt, cursor:"pointer" }}
                value={tone} onChange={e=>setTone(e.target.value)}
                onFocus={onFocusFn} onBlur={onBlurFn}>
                {TONE_OPTIONS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>

            {/* enfoque */}
            <div>
              <label style={{ ...labelSt, display:"flex", alignItems:"center", gap:6 }}>
                Enfoque del mensaje
                {selectedPub && <span style={{ fontSize:10, fontWeight:600, color:"#059669", background:"rgba(5,150,105,0.10)", padding:"1px 7px", borderRadius:20, letterSpacing:"0.04em" }}>auto del calendario</span>}
              </label>
              <select style={{ ...inputSt, cursor:"pointer" }} value={focus}
                onChange={e=>setFocus(e.target.value)} onFocus={onFocusFn} onBlur={onBlurFn}>
                {FOCUS_OPTIONS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
          </HelpCard>

          {/* ── STEP 4: Author / tone ── */}
          <HelpCard
            title="Tono personal del autor"
            hint="Elige quién firma el post y se redactará imitando su estilo real de LinkedIn (emojis, hashtags, longitud, forma de escribir). Usa “Adaptar tono” para crear el perfil pegando sus publicaciones."
          >
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <IconTile>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </IconTile>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Autor y tono personal
              </span>
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-secondary)", fontWeight:500 }}>opcional</span>
            </div>
            <p style={{ fontSize:13, color:"var(--text-secondary)", margin:"-6px 0 14px", lineHeight:1.5 }}>
              Elige quién firma el post y se redactará con su estilo real de LinkedIn.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <label htmlFor="post-person" style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>
                Autor del post
              </label>
              <select id="post-person" style={{ ...inputSt, flex:1, cursor:"pointer" }} value={person}
                onChange={e=>setPerson(e.target.value)} onFocus={onFocusFn} onBlur={onBlurFn}>
                <option value="">Sin tono personal</option>
                {allPeople.map(p=>(
                  <option key={p} value={p}>
                    {p}{profileFiles.some(f => fileMatchesPerson(f, p)) ? " · tono listo ✓" : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={()=>setShowTone(true)}
                style={{
                  height:48, padding:"0 16px", borderRadius:10, flexShrink:0,
                  border:`1px solid ${profile ? "rgba(var(--accent-rgb),0.50)" : "var(--cal-urlbar-border)"}`,
                  background: profile ? "rgba(var(--accent-rgb),0.14)" : "var(--cal-cell-bg)",
                  color: profile ? "var(--accent)" : "var(--text-primary)",
                  fontSize:12, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                  boxShadow:"0 1px 6px rgba(0,0,0,0.08)",
                  transition:"all 180ms",
                  whiteSpace:"nowrap",
                }}>
                ✦ {profile ? "Tono activo" : "Adaptar tono"}
              </button>
            </div>
            {person && fileProfile && (
              <div role="status" style={{
                marginTop:10, padding:"10px 14px", borderRadius:10,
                background:"var(--status-success-bg)",
                border:"1px solid var(--status-success-line)",
                display:"flex", alignItems:"flex-start", gap:10,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:2 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <div style={{ fontSize:13, color:"var(--text-primary)", lineHeight:1.5 }}>
                  <strong>El post saldrá con el tono de {person}</strong>
                  {fileProfile.style ? <> · {fileProfile.style}</> : null}
                  <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:2 }}>Perfil: {fileProfile.fileName}</div>
                </div>
              </div>
            )}
            {person && !fileProfile && !profile && (
              <p style={{ marginTop:10, fontSize:12, color:"var(--text-secondary)", lineHeight:1.5 }}>
                {person} aún no tiene perfil de tono. Usa “Adaptar tono” para crearlo con sus posts reales.
              </p>
            )}
            {profile && !fileProfile && (
              <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:5 }}>
                {[
                  `Estilo ${profile.writingStyle}`,
                  profile.usesEmojis ? "Emojis ✓" : null,
                  profile.usesHashtags ? "Hashtags ✓" : null,
                  profile.usesQuestions ? "Preguntas ✓" : null,
                  `~${profile.avgWordsPerPost} palabras`,
                ].filter(Boolean).map((tag,i)=>(
                  <span key={i} style={{
                    padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600,
                    background:"rgba(var(--accent-rgb),0.12)", color:"var(--accent)",
                    border:"1px solid rgba(var(--accent-rgb),0.20)",
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </HelpCard>

          {/* generate btn */}
          <button type="button" onClick={handleGenerate}
            disabled={!topic.trim() || isGen}
            className="ripple-effect hover-lift"
            style={{
              height:56, borderRadius:12,
              border: topic.trim() ? "1px solid var(--btn-primary-border)" : "1px solid var(--cal-border)",
              background: !topic.trim() ? "var(--cal-cell-bg)" : "var(--btn-primary-bg)",
              color: !topic.trim() ? "var(--text-muted)" : "var(--btn-primary-text)",
              fontSize:16, fontFamily:"var(--font-sans)", fontWeight:700,
              cursor: !topic.trim() ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow: topic.trim() ? "var(--shadow-btn-primary)" : "none",
              opacity: isGen ? 0.75 : 1,
              transition:"all 220ms",
              letterSpacing:"-0.01em",
            }}>
            {isGen ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="7"/>
                </svg>
                Generando tu post…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor"/>
                </svg>
                Generar post
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT: Generated ── */}
        <div style={{
          display:"flex", flexDirection:"column", overflow:"hidden",
          background:"var(--cal-section-bg)",
        }}>
          {/* top bar */}
          <div style={{
            padding:"16px 28px", borderBottom:"1px solid var(--cal-border)",
            display:"flex", alignItems:"center", gap:10, flexShrink:0,
            background:"var(--cal-header-bg)",
          }}>
            <span style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text-primary)", flex:1 }}>
              Post generado
            </span>
            <button type="button" onClick={handleGenerate}
              disabled={!topic.trim() || isGen}
              style={{
                height:38, padding:"0 16px", borderRadius:10,
                border:"1px solid var(--cal-border)",
                background:"var(--cal-cell-bg)",
                color: !topic.trim() || isGen ? "var(--text-muted)" : "var(--text-primary)",
                fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600,
                cursor: !topic.trim() || isGen ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:6,
                opacity: !generated ? 0.6 : 1,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
              }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
              Regenerar
            </button>
            <button type="button" onClick={handleCopy} disabled={!generated}
              style={{
                height:38, padding:"0 16px", borderRadius:10,
                border:`1.5px solid ${copied ? "rgba(var(--accent-rgb),0.45)" : "var(--cal-border)"}`,
                background: copied ? "rgba(var(--accent-rgb),0.12)" : "var(--cal-cell-bg)",
                color: copied ? "var(--accent)" : "var(--text-primary)",
                fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600,
                cursor: !generated ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:6,
                opacity: !generated ? 0.6 : 1,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                transition:"all 180ms",
              }}>
              {copied ? "✓ Copiado" : (
                <>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                  </svg>
                  Copiar texto
                </>
              )}
            </button>
          </div>

          {/* generated area */}
          <div style={{ flex:1, position:"relative", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            {!generated ? (
              <div style={{
                position:"absolute", inset:0,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16,
                padding:32,
              }}>
                <div style={{
                  width:64, height:64, borderRadius:18,
                  background:"var(--icon-tile-bg)",
                  border:"1px solid var(--icon-tile-border)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"var(--icon-tile-shadow)",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>
                    {topic.trim() ? "Listo para generar" : "Configura tu post"}
                  </p>
                  <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, maxWidth:260 }}>
                    {topic.trim()
                      ? `Haz clic en "Generar post" y tu contenido aparecerá aquí listo para editar.`
                      : "Describe el tema a la izquierda, ajusta el estilo, elige el autor y genera."}
                  </p>
                </div>
                {topic.trim() && (
                  <button type="button" onClick={handleGenerate}
                    className="ripple-effect hover-lift"
                    style={{
                      height:40, padding:"0 20px", borderRadius:12,
                      border:"1px solid var(--btn-primary-border)",
                      background:"var(--btn-primary-bg)", color:"var(--btn-primary-text)",
                      fontSize:13, fontFamily:"var(--font-sans)", fontWeight:700,
                      cursor:"pointer", display:"flex", alignItems:"center", gap:7,
                      boxShadow:"var(--shadow-btn-primary)",
                    }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor"/>
                    </svg>
                    Generar post
                  </button>
                )}
              </div>
            ) : (
              <>
                {genMode === "local" && (
                  <div role="status" style={{
                    margin:"14px 28px 0", padding:"8px 12px", borderRadius:8, flexShrink:0,
                    background:"var(--status-error-bg)", border:"1px solid var(--status-error-line)",
                    fontSize:12, fontWeight:600, color:"var(--status-error)",
                  }}>
                    Sin conexión con la IA: se usó una plantilla local. Revisa el texto antes de publicar.
                  </div>
                )}
                <textarea
                  aria-label="Post generado (editable)"
                  style={{
                    width:"100%", flex:1, padding:"32px 36px",
                    border:"none", background:"transparent",
                    color:"var(--text-primary)", fontSize:15.5, fontFamily:"var(--font-sans)",
                    lineHeight:1.85, resize:"none", outline:"none", fontWeight:450,
                  }}
                  value={generated}
                  onChange={e=>setGenerated(e.target.value)}
                />
              </>
            )}
          </div>

          {/* bottom bar */}
          <div style={{
            padding:"14px 28px", borderTop:"1px solid var(--cal-border)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"var(--cal-header-bg)", flexShrink:0,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, color: generated.length > 2800 ? "var(--status-error)" : "var(--text-secondary)", fontFamily:"var(--font-sans)", fontWeight:500 }}>
                {generated.length} <span style={{ color:"var(--text-muted)" }}>/ 3000</span>
              </span>
              {generated.length > 2800 && (
                <span style={{ fontSize:12, color:"var(--status-error)", fontWeight:600 }}>Cerca del límite</span>
              )}
              {generated && (
                <HintZone
                  title="Perfiles ICP · vía Apollo"
                  hint="Sugiere cuentas y personas de tu cliente ideal (ICP) para interactuar, según el producto y el país del post. Consulta Apollo sin gastar créditos."
                >
                  <button type="button" onClick={()=>setShowSuggest(true)} style={{
                    height:30, padding:"0 12px", borderRadius:8,
                    border:"1px solid var(--cal-border)", background:"var(--cal-cell-bg)",
                    color:"var(--text-secondary)", fontSize:12, fontWeight:600,
                    fontFamily:"var(--font-sans)", cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                  }}>
                    👥 Perfiles para seguir
                  </button>
                </HintZone>
              )}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <HintZone
                title="Guardar y publicar"
                hint="Guardar post lo archiva como borrador (queda en el historial del autor). Publicar en LinkedIn copia el texto y abre LinkedIn listo para pegar y publicar."
                style={{ gap:8 }}
              >
              <button type="button" onClick={()=>setShowSave(true)} disabled={!generated}
                className="ripple-effect hover-lift"
                style={{
                  height:42, padding:"0 18px", borderRadius:10,
                  border:`1.5px solid ${generated ? "rgba(var(--accent-rgb),0.40)" : "var(--cal-border)"}`,
                  background: generated ? "rgba(var(--accent-rgb),0.10)" : "var(--cal-cell-bg)",
                  color: generated ? "var(--accent)" : "var(--text-muted)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: !generated ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", gap:7,
                  opacity: !generated ? 0.5 : 1,
                  boxShadow: generated ? "var(--shadow-btn)" : "none",
                  transition:"all 180ms",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Guardar post
              </button>
              <button type="button" onClick={handlePostLinkedIn} disabled={!generated}
                className="ripple-effect hover-lift"
                style={{
                  height:42, padding:"0 20px", borderRadius:10,
                  border:"1px solid var(--linkedin-line)",
                  background: generated ? "var(--linkedin-bg)" : "var(--cal-cell-bg)",
                  color: generated ? "var(--linkedin)" : "var(--text-muted)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: !generated ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", gap:8,
                  opacity: !generated ? 0.5 : 1,
                  boxShadow: generated ? "var(--shadow-btn)" : "none",
                  transition:"all 180ms",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Publicar en LinkedIn
              </button>
              </HintZone>
            </div>
          </div>
        </div>
      </div>

      {showTone && (
        <ToneAdapterModal
          initialPerson={person}
          people={allPeople}
          onSaved={handleToneSaved}
          onClose={()=>{ setShowTone(false); setFileProfileMap({}); }}
        />
      )}

      {/* ── Save post modal ── */}
      {showSave && (
        <SavePostModal
          person={person}
          people={allPeople}
          topic={cleanTopic}
          preview={generated}
          saveStatus={saveStatus}
          savedFile={savedFile}
          onSave={handleSavePost}
          onClose={()=>{ if(saveStatus==="saving") return; setShowSave(false); setSaveStatus("idle"); }}
        />
      )}

      {/* ── Suggested accounts (ICP) modal ── */}
      {showSuggest && (
        <SuggestedAccountsModal
          category={suggestCategory}
          country={country}
          publicationId={selectedPubId || `create-adhoc-${country}`}
          onChangeCategory={setSuggestCategory}
          onClose={()=>setShowSuggest(false)}
        />
      )}
    </>
  );
}

// ── MacWindow ─────────────────────────────────────────────────────────────────

export function MacWindow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      borderRadius:14, overflow:"hidden", minHeight:0,
      border:"1px solid var(--cal-border)",
      background:"var(--cal-window-bg)",
      boxShadow:"var(--shadow-window)",
    }}>
      {/* Titlebar */}
      <div aria-hidden="true" style={{
        height:40, flexShrink:0,
        background:"var(--cal-titlebar-bg)",
        borderBottom:"1px solid var(--cal-border)",
        display:"flex", alignItems:"center",
        paddingLeft:16, paddingRight:16,
        userSelect:"none",
      }}>
        <div style={{ display:"flex", gap:7, marginRight:18 }}>
          {(["#ff5f57","#febc2e","#28c840"] as const).map((col, i) => (
            <div key={i} style={{
              width:12, height:12, borderRadius:"50%", background:col,
              boxShadow:"inset 0 0.5px 1px rgba(0,0,0,0.25)",
            }} />
          ))}
        </div>
        <div style={{
          flex:1, maxWidth:360, margin:"0 auto",
          height:24, borderRadius:7,
          background:"var(--cal-urlbar-bg)",
          border:"1px solid var(--cal-border)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:500, color:"var(--text-muted)",
          fontFamily:"var(--font-sans)", letterSpacing:"0.01em",
        }}>
          linkedin-calendar.local
        </div>
        <div style={{ width:75 }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        {children}
      </div>
    </div>
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────────

interface ToastItem { id: number; kind: "success" | "error"; msg: string; retry?: () => void }
let toastSeq = 0;

function Toasts({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" style={{
      position:"fixed", right:20, bottom:20, zIndex:1000,
      display:"flex", flexDirection:"column", gap:8, pointerEvents:"none",
    }}>
      {toasts.map(t => (
        <div key={t.id} role="status" className="animate-toast-in" style={{
          display:"flex", alignItems:"center", gap:12, maxWidth:360,
          padding:"12px 14px 12px 16px", borderRadius:10,
          fontSize:13, fontWeight:600, fontFamily:"var(--font-sans)",
          color:"#fff", pointerEvents:"auto",
          background: t.kind === "success" ? "#15803d" : "#b91c1c",
          boxShadow:"0 8px 30px rgba(0,0,0,0.28)",
        }}>
          <span style={{ flex:1 }}>{t.msg}</span>
          {t.retry && (
            <button type="button"
              onClick={() => { onDismiss(t.id); t.retry?.(); }}
              style={{
                border:"1px solid rgba(255,255,255,0.45)", background:"rgba(255,255,255,0.14)",
                color:"#fff", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700,
                cursor:"pointer", fontFamily:"var(--font-sans)", flexShrink:0,
              }}>
              Reintentar
            </button>
          )}
          <button type="button" aria-label="Cerrar aviso" onClick={() => onDismiss(t.id)}
            style={{
              border:"none", background:"transparent", color:"#fff", opacity:0.85,
              cursor:"pointer", fontSize:15, lineHeight:1, padding:2, flexShrink:0,
            }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── CalendarPage ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [dark,      setDark]      = useState(true);
  const [activeTab, setActiveTab] = useState<"calendar"|"create">("calendar");
  const [createPubId, setCreatePubId] = useState("");
  const [filter, setFilter] = useState<CountryKey>("LATAM");
  const [year,   setYear]   = useState(() => TODAY.getFullYear());
  const [month,  setMonth]  = useState(() => TODAY.getMonth());
  const [pubs,   setPubs]   = useState<Publication[]>(SEED);
  const [modal,  setModal]  = useState<ModalState>({ mode:"closed" });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [customPeople, setCustomPeople] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("custom_people") ?? "[]"); } catch { return []; }
  });
  // Personas con perfil de tono (Supabase + archivos) — para sugerirlas también al crear cards
  const [tonePeople, setTonePeople] = useState<string[]>([]);
  // Tarjeta recién creada → dispara la búsqueda de ICPs en Apollo (categoría + país del card)
  const [suggestFor, setSuggestFor] = useState<{ category: string; country: CountryKey; publicationId: string } | null>(null);

  const dismissToast = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), []);
  const notify = useCallback((kind: ToastItem["kind"], msg: string, retry?: () => void) => {
    const id = ++toastSeq;
    setToasts(ts => [...ts, { id, kind, msg, retry }]);
    if (kind === "success") setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4000);
  }, []);

  const addPerson = useCallback((name: string) => {
    setCustomPeople(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      try { localStorage.setItem("custom_people", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const allKnownPeople = useMemo(
    () => [...new Set([...PEOPLE, ...tonePeople, ...customPeople])],
    [tonePeople, customPeople]
  );

  // Carga las personas que ya tienen tono guardado (p. ej. creadas desde "Adaptar tono")
  useEffect(() => {
    fetch("/api/tone-profile")
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.people)) {
          setTonePeople(d.people.map((p: { name: string }) => p.name).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  const todayStr = toDateStr(TODAY);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Sigue la configuración de tema del sistema: aplica el valor al montar y reacciona si el usuario lo cambia en su SO
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (modal.mode !== "closed" || activeTab !== "calendar") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); prevMonth(); }
      if (e.key === "ArrowRight") { e.preventDefault(); nextMonth(); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setModal({ mode:"create", date: todayStr }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  useEffect(() => {
    fetch("/api/publications")
      .then(r => r.json())
      .then((data: Publication[]) => { if (Array.isArray(data) && data.length > 0) setPubs(data); })
      .catch(() => notify("error", "No se pudieron cargar las publicaciones guardadas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visiblePubs = useMemo(() => pubs.filter(p => filter === "LATAM" || p.country === filter), [pubs, filter]);
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); }

  function savePub(p: Publication) {
    const isNew = !pubs.some(x => x.id === p.id);
    setPubs(prev => {
      const i = prev.findIndex(x => x.id === p.id);
      return i >= 0 ? prev.map((x, idx) => idx === i ? p : x) : [...prev, p];
    });
    if (isNew) setSuggestFor({ category: p.category ?? "Digital Identity", country: p.country, publicationId: p.id });
    fetch("/api/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); notify("success", "Publicación guardada"); })
      .catch(() => notify("error", "No se pudo guardar la publicación.", () => savePub(p)));
  }

  function deletePub(id: string) {
    setPubs(prev => prev.filter(p => p.id !== id));
    setModal({ mode:"closed" });
    fetch("/api/publications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); notify("success", "Publicación eliminada"); })
      .catch(() => notify("error", "No se pudo eliminar la publicación."));
  }

  function weekFlags(week: Date[]) {
    const seen = new Set<string>();
    return week.flatMap(d =>
      eventsForDay(d, visiblePubs).map(({ pub }) => CMAP[pub.country].flag)
        .filter(f => { if (seen.has(f)) return false; seen.add(f); return true; })
    ).slice(0,5);
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === month && d.getFullYear() === year;

  return (
    <div style={{
      height:"100svh", display:"flex", flexDirection:"column",
      padding:"12px", position:"relative", zIndex:1,
    }}>

      <MacWindow>
        {/* ── Toolbar ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 24px", height:62, flexShrink:0,
          borderBottom:"1px solid var(--cal-border)",
          background:"var(--cal-toolbar-bg)",
          gap:12,
        }}>
          {/* Logo + Tabs */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)" style={{ flexShrink:0 }}>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <HintZone
              title="Las dos vistas"
              hint="Calendario: planifica y visualiza tus publicaciones por país y fecha. Crea tu post: redacta el contenido con ayuda de IA y el tono de cada autor."
            >
            <div style={{ display:"flex", gap:3, background:"var(--cal-cell-bg)", borderRadius:12, padding:4, border:"1px solid var(--cal-border)" }}>
              {([
                { id:"calendar" as const, label:"Calendario",      icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
                { id:"create"   as const, label:"Crea tu post",  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
              ] as const).map(tab => (
                <button key={tab.id} type="button" onClick={()=>setActiveTab(tab.id)}
                  aria-pressed={activeTab===tab.id}
                  style={{
                    display:"flex", alignItems:"center", gap:7,
                    height:34, padding:"0 18px", borderRadius:8, border:"none",
                    background: activeTab===tab.id ? "var(--tab-active-bg)" : "transparent",
                    color: activeTab===tab.id ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize:14, fontFamily:"var(--font-sans)", fontWeight:600,
                    cursor:"pointer", transition:"all 180ms",
                    boxShadow: activeTab===tab.id ? "var(--shadow-btn)" : "none",
                    letterSpacing:"-0.01em",
                  }}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            </HintZone>
          </div>

          {/* Right controls */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {activeTab === "calendar" && (
              <>
                <HintZone
                  title="Nuevo post"
                  hint="Abre una tarjeta para programar una publicación: título, contenido, país, producto, fechas y las personas que la firman. También puedes hacer clic en cualquier día del calendario."
                >
                  <GlassBtn onClick={() => setModal({ mode:"create", date:todayStr })} accent>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    Nuevo post
                  </GlassBtn>
                </HintZone>
                <HintZone
                  title="Filtro por mercado"
                  hint="Muestra solo las publicaciones de un país. Elige LATAM para ver todos los mercados a la vez. El país siempre se acompaña de su bandera y nombre."
                >
                  <CountryDropdown selected={filter} onChange={setFilter} />
                </HintZone>
              </>
            )}
            <GlassBtn onClick={() => setDark(!dark)} small aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </GlassBtn>
          </div>
        </div>

        {activeTab === "create" && <PostCreator dark={dark} pubs={pubs} initialPubId={createPubId} key={createPubId} extraPeople={customPeople} />}

        {activeTab === "calendar" && <>
        {/* ── Month header ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 20px", borderBottom:"1px solid var(--cal-border)",
          flexShrink:0, gap:14,
          background:"var(--cal-section-bg)",
        }}>
          {/* Month name + inline arrows */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <h1 style={{
              fontSize:"clamp(1.8rem,4vw,3.2rem)", lineHeight:1, fontWeight:700,
              letterSpacing:"-0.03em", color:"var(--text-primary)", whiteSpace:"nowrap",
            }}>
              {MONTHS_FULL[month]}
              <span style={{ color:"var(--text-muted)", marginLeft:"0.3em", fontSize:"0.48em", fontWeight:400, verticalAlign:"middle" }}>
                {year}
              </span>
            </h1>

            {/* Arrow buttons — same style as the screenshot */}
            <HintZone
              style={{ alignSelf:"center" }}
              title="Navegación"
              hint="Cambia de mes con las flechas o con las teclas ← →. Haz clic en cualquier día para programar una publicación en esa fecha; pulsa N para crear una nueva."
            >
            <div style={{ display:"flex", gap:6, alignSelf:"center", marginTop:2 }}>
              {[
                { fn: prevMonth, label:"Mes anterior",  d:"M7 1L1 6.5L7 12" },
                { fn: nextMonth, label:"Mes siguiente", d:"M1 1L7 6.5L1 12" },
              ].map(({ fn, label, d }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  aria-label={label}
                  className="hover-lift"
                  style={{
                    width:24, height:24, borderRadius:7, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border:"1px solid var(--cal-border)",
                    background:"var(--cal-cell-hover)",
                    cursor:"pointer",
                    boxShadow:"var(--shadow-btn)",
                    transition:"opacity 160ms, transform 240ms",
                    color:"var(--text-primary)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <svg width="6" height="9" viewBox="0 0 8 13" fill="none">
                    <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
            </HintZone>
          </div>
        </div>

        {/* ── Day-of-week header ── */}
        <div role="row" style={{
          display:"grid", gridTemplateColumns:"36px repeat(7,1fr)",
          borderBottom:"1px solid var(--cal-border)",
          flexShrink:0, background:"var(--cal-header-bg)",
        }}>
          <div style={{ borderRight:"1px solid rgba(255,255,255,0.18)" }} aria-hidden="true" />
          {DAYS.map((d, i) => (
            <div key={d} role="columnheader"
              aria-label={["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][i]}
              style={{
                padding:"7px 0", textAlign:"center",
                fontSize:11, fontWeight:600, letterSpacing:"0.05em",
                fontFamily:"var(--font-sans)",
                color:"var(--text-secondary)",
                borderLeft:"1px solid var(--cal-border)",
                textTransform:"uppercase",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* ── Calendar grid ── */}
        <div role="grid" aria-label={`${MONTHS_FULL[month]} ${year}`}
          style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto", minHeight:0 }}>
          {weeks.map((week, wi) => {
            const flags      = weekFlags(week);
            const evRows     = layoutWeekEvents(getWeekEvents(week, visiblePubs));
            const evRowCount = evRows.length;

            return (
              <div key={wi} role="row" style={{
                flex:1, display:"flex",
                borderBottom: wi < weeks.length-1 ? `1px solid var(--cal-border)` : "none",
                minHeight: Math.max(72, 32 + evRowCount * 26 + 8),
              }}>
                {/* Week gutter */}
                <div aria-hidden="true" style={{
                  width:36, flexShrink:0,
                  borderRight:"1px solid var(--cal-border)",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", paddingTop:6, gap:2, overflow:"hidden",
                }}>
                  {flags.map((f, fi) => (
                    <span key={fi} style={{ fontSize:13, lineHeight:"17px", flexShrink:0 }}>{f}</span>
                  ))}
                </div>

                {/* Days area */}
                <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)", position:"relative" }}>

                  {/* Day background cells — click targets + date numbers */}
                  {week.map((day, di) => {
                    const ds      = toDateStr(day);
                    const isToday = ds === todayStr;
                    const inMonth = isCurrentMonth(day);
                    const weekend = di===0 || di===6;

                    return (
                      <div key={di} role="gridcell" tabIndex={0}
                        aria-label={day.toLocaleDateString("es-CO",{weekday:"long",month:"long",day:"numeric"})}
                        onClick={() => setModal({ mode:"create", date:ds })}
                        onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); setModal({ mode:"create", date:ds }); } }}
                        style={{
                          borderLeft: di > 0 ? "1px solid var(--cal-border)" : "none",
                          cursor:"pointer",
                          background: isToday
                            ? "var(--cal-cell-today)"
                            : weekend ? "var(--cal-cell-weekend)" : "var(--cal-cell-bg)",
                          display:"flex", flexDirection:"column",
                          transition:"background 150ms", outline:"none",
                        }}
                        onMouseEnter={e => { if (!isToday) (e.currentTarget as HTMLElement).style.background = "var(--cal-cell-hover)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isToday ? "var(--cal-cell-today)" : weekend ? "var(--cal-cell-weekend)" : "var(--cal-cell-bg)"; }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = "inset 0 0 0 2px var(--accent)"; }} 
                        onBlur={e  => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                      >
                        <div style={{ padding:"4px 5px 2px", display:"flex", justifyContent:"flex-end", flexShrink:0 }}>
                          <span style={{
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            width:24, height:24, borderRadius:"50%", fontSize:12,
                            fontFamily:"var(--font-sans)", fontWeight: isToday ? 700 : 500,
                            background: isToday ? "var(--accent)" : "transparent",
                            color: isToday ? "var(--accent-text)" : inMonth ? "var(--text-primary)" : "var(--text-muted)",
                            opacity: inMonth ? 1 : 0.55,
                            boxShadow:"none",
                          }}>
                            {day.getDate()}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Spanning event chips — absolutely positioned over the grid */}
                  {evRows.flatMap((row, rowIdx) =>
                    row.map(({ pub, startCol, endCol }) => {
                      const c       = CMAP[pub.country];
                      const bg      = dark ? c.bgDark : c.bgLight;
                      const fg      = dark ? c.colorDark : c.color;
                      const colSpan = endCol - startCol + 1;
                      return (
                        <button
                          key={pub.id}
                          type="button"
                          onClick={e => { e.stopPropagation(); setModal({ mode:"view", pub }); }}
                          title={pub.title}
                          style={{
                            position:"absolute",
                            top: 30 + rowIdx * 26,
                            left:`calc(${startCol} / 7 * 100% + 2px)`,
                            width:`calc(${colSpan} / 7 * 100% - 4px)`,
                            height:22,
                            zIndex:10,
                            background:bg, color:fg,
                            border:"1px solid var(--cal-border)",
                            borderRadius:6,
                            cursor:"pointer", fontSize:11,
                            fontFamily:"var(--font-sans)", fontWeight:600,
                            overflow:"hidden", whiteSpace:"nowrap",
                            display:"flex", alignItems:"center",
                            padding:"0 6px", gap:4,
                            boxShadow:"0 1px 2px rgba(0,0,0,0.20)",
                            transition:"opacity 120ms, transform 200ms",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.opacity = "0.88";
                            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.opacity = "1";
                            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                          }}
                        >
                          <span style={{ fontSize:12, flexShrink:0 }}>{c.flag}</span>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", flex:1 }}>{pub.title}</span>
                          <span style={{ display:"flex", alignItems:"center", gap:0, flexShrink:0 }}>
                            {pub.people.slice(0,2).map((p, i) => (
                              <span key={i} style={{ marginLeft: i===0 ? 0 : -4 }}>
                                <PersonBadge name={p} size={16} />
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Status bar ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"7px 20px", borderTop:"1px solid var(--cal-border)",
          background:"var(--cal-statusbar-bg)",
          fontSize:12, fontWeight:500, letterSpacing:"0.01em",
          color:"var(--text-secondary)", flexShrink:0,
        }}>
          <span>
            {visiblePubs.length} post{visiblePubs.length!==1?"s":""}
            <span style={{ color:"var(--text-muted)", margin:"0 6px" }}>·</span>
            {filter==="LATAM" ? "Todos los mercados" : CMAP[filter].label}
          </span>
          <span style={{ color:"var(--text-secondary)" }}>Clic en un día para planificar · N nuevo post · ← → cambiar mes</span>
        </div>
        </>}
      </MacWindow>

      {modal.mode !== "closed" && (
        <PublicationModal
          key={`${modal.mode}-${"pub" in modal ? modal.pub.id : "new"}`}
          state={modal as Exclude<ModalState, { mode:"closed" }>}
          dark={dark}
          onSave={savePub}
          onDelete={deletePub}
          onClose={() => setModal({ mode:"closed" })}
          onEdit={pub => setModal({ mode:"edit", pub })}
          onGoToCreate={pubId => { setModal({ mode:"closed" }); setCreatePubId(pubId); setActiveTab("create"); }}
          knownPeople={allKnownPeople}
          onAddPerson={addPerson}
        />
      )}

      {/* Tarjeta recién creada → búsqueda de ICPs en Apollo según producto + país del card */}
      {suggestFor && (
        <SuggestedAccountsModal
          category={suggestFor.category}
          country={suggestFor.country}
          publicationId={suggestFor.publicationId}
          onChangeCategory={c => setSuggestFor(s => s ? { ...s, category: c } : s)}
          onClose={() => setSuggestFor(null)}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
