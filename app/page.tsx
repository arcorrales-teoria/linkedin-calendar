"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";

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

interface Publication {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  content: string;
  country: CountryKey;
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


function generatePost(pub: Publication): string {
  const cn = pub.country === "LATAM" ? "LATAM" : CMAP[pub.country].label;
  return `🚀 ${pub.title}\n\n[Escribe aquí tu insight principal...]\n\n¿Por qué importa esto para ${cn}?\n• [Punto clave 1]\n• [Punto clave 2]\n• [Punto clave 3]\n\n¿Cuál es tu perspectiva? Comparte en los comentarios 👇${pub.people.length ? `\n\nPor: ${pub.people.join(", ")}` : ""}\n\n#LinkedIn #${cn.replace(/\s/g,"")} #MarketingDigital #Contenido`;
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

// ── EventChip ─────────────────────────────────────────────────────────────────

function EventChip({ pub, role, dark, onClick }: {
  pub: Publication; role: EventRole; dark: boolean; onClick: () => void;
}) {
  const c = CMAP[pub.country];
  const bg = dark ? c.bgDark : c.bgLight;
  const fg = dark ? c.colorDark : c.color;
  const isStart = role === "single" || role === "start";

  if (!isStart) {
    // Continuation bar: glass-tinted, same color family
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick(); }}
        aria-label={`${pub.title} (continued)`}
        style={{
          display:"flex", alignItems:"center", justifyContent:"flex-end",
          width:"100%", height:20, marginBottom:2, paddingRight:4,
          cursor:"pointer", overflow:"hidden",
          background:bg,
          border:"none",
          borderTop:`1px solid rgba(255,255,255,0.22)`,
          borderBottom:`1px solid rgba(0,0,0,0.06)`,
          borderRadius: role === "end" ? "0 5px 5px 0" : 0,
          boxShadow:"0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.28)",
          transition:"opacity 120ms, transform 200ms",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.opacity = "0.82";
          el.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }}
      >
        {role === "end" && (
          <span style={{ fontSize:10, opacity:0.7 }}>{c.flag}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={pub.title}
      style={{
        position:"relative",
        width:"100%", height:20, marginBottom:2, padding:0,
        borderRadius: role === "single" ? 6 : "6px 0 0 6px",
        border:`1px solid rgba(255,255,255,0.30)`,
        borderBottom:`1px solid rgba(0,0,0,0.08)`,
        background:bg, color:fg,
        cursor:"pointer", fontSize:11,
        fontFamily:"var(--font-sans)", fontWeight:600,
        overflow:"hidden", whiteSpace:"nowrap",
        flexShrink:0,
        boxShadow:[
          "0 4px 12px rgba(0,0,0,0.18)",
          "0 1px 4px rgba(0,0,0,0.12)",
          "inset 0 1.5px 0 rgba(255,255,255,0.55)",
          "inset 0 -1px 0 rgba(0,0,0,0.08)",
        ].join(", "),
        transition:"opacity 120ms, transform 200ms, box-shadow 200ms",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = "0.88";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = [
          "0 8px 20px rgba(0,0,0,0.22)",
          "0 2px 6px rgba(0,0,0,0.14)",
          "inset 0 1.5px 0 rgba(255,255,255,0.60)",
          "inset 0 -1px 0 rgba(0,0,0,0.08)",
        ].join(", ");
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = [
          "0 4px 12px rgba(0,0,0,0.18)",
          "0 1px 4px rgba(0,0,0,0.12)",
          "inset 0 1.5px 0 rgba(255,255,255,0.55)",
          "inset 0 -1px 0 rgba(0,0,0,0.08)",
        ].join(", ");
      }}
    >
      {/* Title absolutely centered across the full chip width */}
      <span style={{
        position:"absolute", left:0, right:0, top:0, bottom:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden", paddingLeft:24, paddingRight:24,
        pointerEvents:"none",
      }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"100%", textAlign:"center" }}>
          {pub.title}
        </span>
      </span>
      {/* Flag — left edge */}
      <span style={{ position:"absolute", left:5, top:0, bottom:0, display:"flex", alignItems:"center", fontSize:12 }}>{c.flag}</span>
      {/* People badges — right edge */}
      <span style={{ position:"absolute", right:4, top:0, bottom:0, display:"flex", alignItems:"center", gap:0 }}>
        {pub.people.slice(0,2).map((p,i) => (
        <span key={i} style={{ marginLeft: i===0?0:-4 }}>
          <PersonBadge name={p} size={16} />
        </span>
      ))}
      </span>
    </button>
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
        border: accent ? "1px solid rgba(255,255,255,0.28)" : "1px solid var(--cal-border)",
        background: accent
          ? "var(--accent)"
          : "var(--cal-cell-hover)",
        color: accent ? "var(--accent-text)" : disabled ? "var(--text-muted)" : "var(--text-primary)",
        boxShadow: accent ? "var(--accent-glow), var(--shadow-btn)" : "var(--shadow-btn)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: small ? 13 : 14,
        fontFamily:"var(--font-sans)",
        fontWeight: accent ? 700 : 600,
        letterSpacing:"-0.01em",
        opacity: disabled ? 0.45 : 1,
        flexShrink:0,
        transition:"opacity 160ms, transform 240ms, box-shadow 240ms",
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLElement).style.opacity = "0.82";
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
        aria-label={`Filter by country: ${c.label}`}
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
          aria-label="Select country"
          className="animate-fade-in glass"
          style={{
            position:"absolute", top:"calc(100% + 8px)", right:0,
            borderRadius:14, padding:5, zIndex:100, minWidth:170,
            backdropFilter:"blur(30px) saturate(200%)",
            WebkitBackdropFilter:"blur(30px) saturate(200%)",
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

function PeopleInput({ people, onChange }: { people: string[]; onChange: (p: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = "people-input";

  useClickOutside(containerRef, useCallback(() => setOpen(false), []));

  const filtered = PEOPLE.filter(p => p.toLowerCase().includes(query.toLowerCase()));

  function toggle(name: string) {
    onChange(people.includes(name) ? people.filter(x => x !== name) : [...people, name]);
  }
  function addCustom() {
    const n = query.trim();
    if (n && !people.includes(n)) { onChange([...people, n]); setQuery(""); }
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1.5px solid var(--cal-border)",
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
              background:"var(--cal-cell-hover)",
              border:"1px solid var(--cal-border)",
              fontSize:13, fontWeight:500, color:"var(--text-primary)",
              boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
            }}>
              {p}
              <button type="button" aria-label={`Remove ${p}`}
                onClick={() => onChange(people.filter(x => x !== p))}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:15, lineHeight:1, padding:0, display:"flex", alignItems:"center" }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <label htmlFor={inputId} style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>
        Search or add people
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
          background:"var(--cal-window-bg)",
          border:"1.5px solid var(--cal-border)",
          backdropFilter:"blur(40px) saturate(180%)",
          WebkitBackdropFilter:"blur(40px) saturate(180%)",
          boxShadow:"0 8px 32px rgba(0,0,0,0.22)",
        }}>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding:"12px 14px", fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-sans)" }}>
                {query.trim()
                  ? <><span style={{ color:"var(--text-secondary)" }}>"{query.trim()}"</span> — press Enter to add</>
                  : "No matches"}
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
          <div style={{
            padding:"7px 14px", borderTop:"1px solid var(--cal-border)",
            fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-sans)", letterSpacing:"0.03em",
          }}>
            {people.length} seleccionados · Esc para cerrar
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
        border:"1.5px solid var(--cal-border)",
        borderRadius:12, overflow:"hidden",
        background:"var(--cal-cell-bg)",
        boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.22)",
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
          borderRadius:16,
          border:"1.5px solid rgba(255,255,255,0.35)",
          background:"var(--cal-window-bg)",
          backdropFilter:"blur(60px) saturate(220%)",
          WebkitBackdropFilter:"blur(60px) saturate(220%)",
          boxShadow:"var(--shadow-dropdown)",
          overflow:"hidden",
        }}>
          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"12px 14px 8px", borderBottom:"1px solid var(--cal-border)" }}>
            <button type="button" onClick={prevCal} style={navBtnSt}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
            >‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", fontFamily:"var(--font-sans)" }}>
              {MONTHS_FULL[calMonth]} {calYear}
            </span>
            <button type="button" onClick={nextCal} style={navBtnSt}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}
            >›</button>
          </div>

          {/* Day labels */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"8px 10px 2px" }}>
            {["S","M","T","W","T","F","S"].map((d,i) => (
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
                          opacity: inMonth(day) ? 1 : 0.35,
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

function PublicationModal({ state, dark, onSave, onDelete, onClose, onEdit, onGoToCreate }: {
  state: Exclude<ModalState, { mode: "closed" }>;
  dark: boolean;
  onSave: (p: Publication) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onEdit: (pub: Publication) => void;
  onGoToCreate: (pubId: string) => void;
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
  const [people,  setPeople]  = useState<string[]>(existing?.people ?? []);
  const [copied,  setCopied]  = useState(false);

  const c = CMAP[country];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function handleSave() {
    if (!title.trim()) return;
    onSave({ id: existing?.id ?? uid(), title: title.trim(), content, startDate: sDate, endDate: eDate < sDate ? sDate : eDate, country, people });
    onClose();
  }

  async function handlePostLinkedIn() {
    const text = content || title;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch (_) {}
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1.5px solid var(--cal-border)",
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
    (e.target as HTMLElement).style.boxShadow = "0 0 0 3px rgba(124,58,237,0.22)";
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
      backdropFilter:"blur(14px)",
      WebkitBackdropFilter:"blur(14px)",
    }}>
      <div
        role="dialog" aria-modal="true"
        aria-label={isCreate ? "New publication" : isEdit ? "Edit publication" : existing?.title}
        className="animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          width:"100%", maxWidth:500,
          borderRadius:22,
          border:"1.5px solid rgba(255,255,255,0.40)",
          background:"var(--cal-window-bg)",
          backdropFilter:"blur(80px) saturate(250%)",
          WebkitBackdropFilter:"blur(80px) saturate(250%)",
          boxShadow:"var(--shadow-modal)",
          overflow:"hidden",
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
              <h2 style={{ fontSize:16, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text-primary)" }}>
                {isCreate ? "Nueva publicación" : "Editar publicación"}
              </h2>
            )}
          </div>

          <button type="button" onClick={onClose} aria-label="Close"
            className="hover-lift"
            style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              width:32, height:32, borderRadius:9,
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
                <label htmlFor="pub-title" style={labelStyle}>Title</label>
                <input id="pub-title" style={inputStyle} value={title}
                  onChange={e => setTitle(e.target.value)} placeholder="Post title…"
                  autoFocus onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"end" }}>
                <div>
                  <label style={labelStyle}>Date range</label>
                  <DateRangePicker
                    startDate={sDate} endDate={eDate}
                    onChangeStart={setSDate} onChangeEnd={setEDate}
                  />
                </div>
                <div>
                  <label htmlFor="pub-country" style={labelStyle}>Country</label>
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
                <label style={labelStyle}>People</label>
                <PeopleInput people={people} onChange={setPeople} />
              </div>

              <div>
                <label htmlFor="pub-content" style={labelStyle}>LinkedIn content</label>
                <textarea id="pub-content"
                  style={{ ...inputStyle, minHeight:100, resize:"vertical", lineHeight:1.65 }}
                  value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Write your LinkedIn post here…" onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding:"18px 24px 22px", display:"flex", flexDirection:"column", gap:10 }}>
          {isView ? (
            <>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" onClick={handlePostLinkedIn}
                  className="ripple-effect hover-lift"
                  style={{
                    flex:1, height:42, borderRadius:12,
                    border:"1px solid rgba(255,255,255,0.28)",
                    background:"#0A66C2",
                    color:"#fff", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    cursor:"pointer",
                    boxShadow:"0 4px 18px rgba(10,102,194,0.40), inset 0 1.5px 0 rgba(255,255,255,0.22)",
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

                <button type="button"
                  onClick={() => { onGoToCreate(existing!.id); }}
                  className="ripple-effect hover-lift"
                  style={{
                    flex:1, height:42, borderRadius:12,
                    border:"1.5px solid var(--cal-border)",
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
              </div>

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button type="button" onClick={() => onDelete(existing!.id)}
                  className="ripple-effect"
                  style={{
                    padding:"7px 14px", borderRadius:9, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:500, cursor:"pointer",
                    border:"1px solid rgba(239,68,68,0.30)", background:"rgba(239,68,68,0.10)",
                    color:"#dc2626",
                    transition:"opacity 150ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  Eliminar
                </button>
                <button type="button" onClick={() => onEdit(existing!)}
                  className="ripple-effect hover-lift"
                  style={{
                    padding:"7px 16px", borderRadius:9, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600, cursor:"pointer",
                    border:"1.5px solid var(--cal-border)", background:"var(--cal-cell-bg)",
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
                <button type="button" onClick={() => { onDelete(existing.id); onClose(); }}
                  className="ripple-effect"
                  style={{
                    padding:"0 16px", height:36, borderRadius:10,
                    fontSize:13, fontFamily:"var(--font-sans)", fontWeight:500, cursor:"pointer",
                    border:"1px solid rgba(239,68,68,0.30)", background:"rgba(239,68,68,0.10)",
                    color:"#dc2626",
                  }}
                >
                  Eliminar
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

function ToneAdapterModal({ onClose, initialPerson }: {
  onClose: () => void; initialPerson?: string;
}) {
  const [person,  setPerson]  = useState(initialPerson ?? "");
  const [url,     setUrl]     = useState("");
  const [sample,  setSample]  = useState("");
  const [saved,   setSaved]   = useState<ToneProfile | null>(null);
  const [status,  setStatus]  = useState<"idle"|"analyzing"|"done">("idle");

  useEffect(() => {
    if (person) {
      const p = loadToneProfile(person);
      setSaved(p);
      if (p) { setUrl(p.linkedinUrl); setSample(p.sampleText); }
      else   { setUrl(""); setSample(""); }
    }
  }, [person]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function handleAnalyze() {
    if (!person.trim() || sample.trim().length < 30) return;
    setStatus("analyzing");
    setTimeout(() => {
      const profile = analyzeTone(sample, person.trim(), url.trim());
      saveToneProfile(profile);
      setSaved(profile);
      setStatus("done");
    }, 900);
  }

  const inputSt: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1.5px solid var(--cal-border)", background:"var(--cal-cell-bg)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
  };
  const labelSt: React.CSSProperties = {
    display:"block", marginBottom:6, fontSize:12,
    fontFamily:"var(--font-sans)", fontWeight:600,
    letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--text-secondary)",
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
      padding:20, backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
    }}>
      <div className="animate-slide-up" onClick={e=>e.stopPropagation()} style={{
        width:"100%", maxWidth:520,
        borderRadius:22, border:"1.5px solid rgba(255,255,255,0.40)",
        background:"var(--cal-window-bg)",
        backdropFilter:"blur(80px) saturate(250%)",
        WebkitBackdropFilter:"blur(80px) saturate(250%)",
        boxShadow:"var(--shadow-modal)", overflow:"hidden",
      }}>
        {/* accent bar */}
        <div style={{ height:4, background:"var(--accent)", opacity:0.85 }} />

        {/* header */}
        <div style={{ padding:"20px 24px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text-primary)" }}>
              Adaptar tono de escritura
            </h2>
            <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, lineHeight:1.5 }}>
              Pega posts reales de LinkedIn para que el generador aprenda tu estilo.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            width:32, height:32, borderRadius:9, border:"1px solid var(--cal-border)",
            background:"var(--cal-cell-bg)", color:"var(--text-muted)",
            cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0,
          }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding:"18px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          {/* person */}
          <div>
            <label style={labelSt}>Persona</label>
            <select style={{ ...inputSt, cursor:"pointer" }} value={person}
              onChange={e=>setPerson(e.target.value)} onFocus={onFocus} onBlur={onBlur}>
              <option value="">Selecciona o escribe…</option>
              {PEOPLE.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* linkedin url */}
          <div>
            <label style={labelSt}>URL de LinkedIn (opcional)</label>
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
                    border:"1.5px solid rgba(10,102,194,0.50)", background:"rgba(10,102,194,0.12)",
                    color:"#0A66C2", fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600,
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
            <label style={labelSt}>Posts de LinkedIn{saved ? " (actualizar)" : ""}</label>
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
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--accent)", marginBottom:8 }}>
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
          <GlassBtn accent disabled={!person.trim() || sample.trim().length < 30 || status === "analyzing"}
            onClick={handleAnalyze}>
            {status === "analyzing"
              ? "Analizando…"
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
  person, topic, preview, saveStatus, savedFile, onSave, onClose,
}: {
  person: string;
  topic: string;
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
            background:"rgba(var(--accent-rgb),0.14)",
            border:"1.5px solid rgba(var(--accent-rgb),0.25)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
          <button type="button" onClick={onClose} disabled={saveStatus==="saving"}
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
          <label style={{ display:"block", marginBottom:6, fontSize:12, fontWeight:700, color:"var(--text-primary)", letterSpacing:"0.04em", textTransform:"uppercase" }}>
            ¿Para quién es este post?
          </label>
          <select
            value={savePerson}
            onChange={e => setSavePerson(e.target.value)}
            disabled={saveStatus !== "idle"}
            style={{
              width:"100%", padding:"11px 14px", borderRadius:10, marginBottom:16,
              border:"1.5px solid var(--cal-border)",
              background:"var(--cal-urlbar-bg)",
              color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
              fontWeight:500, cursor:"pointer", outline:"none",
            }}
          >
            <option value="">Solo guardar (sin perfil)</option>
            {PEOPLE.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* preview */}
          <label style={{ display:"block", marginBottom:6, fontSize:12, fontWeight:700, color:"var(--text-primary)", letterSpacing:"0.04em", textTransform:"uppercase" }}>
            Vista previa
          </label>
          <div style={{
            padding:"14px 16px", borderRadius:12, marginBottom:20,
            background:"var(--cal-section-bg)",
            border:"1.5px solid var(--cal-border)",
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
              borderRadius:12, background:"rgba(22,163,74,0.12)",
              border:"1.5px solid rgba(22,163,74,0.28)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <p style={{ fontSize:13, fontWeight:700, color:"#16a34a", margin:0 }}>Post guardado</p>
                {savedFile && (
                  <p style={{ fontSize:11, color:"#16a34a", opacity:0.78, margin:"2px 0 0", fontWeight:500 }}>{savedFile}</p>
                )}
              </div>
            </div>
          ) : saveStatus === "error" ? (
            <div style={{
              display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
              borderRadius:12, background:"rgba(220,38,38,0.10)",
              border:"1.5px solid rgba(220,38,38,0.28)",
              marginBottom:12,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ fontSize:13, fontWeight:600, color:"#dc2626", margin:0 }}>No se pudo guardar. Intenta de nuevo.</p>
            </div>
          ) : (
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onClose}
                style={{
                  flex:1, height:44, borderRadius:11,
                  border:"1.5px solid var(--cal-border)",
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
                  flex:2, height:44, borderRadius:11,
                  border:"1.5px solid rgba(var(--accent-rgb),0.45)",
                  background:"var(--accent)", color:"var(--accent-text)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: saveStatus === "saving" ? "wait" : "pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  boxShadow:"var(--accent-glow)",
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

// ── PostCreator ───────────────────────────────────────────────────────────────

function PostCreator({ dark, pubs, initialPubId }: { dark: boolean; pubs: Publication[]; initialPubId?: string }) {
  const [selectedPubId, setSelectedPubId] = useState(initialPubId ?? "");
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
  const [showTone,    setShowTone]    = useState(false);
  const [showSave,    setShowSave]    = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [savedFile,   setSavedFile]   = useState("");

  // Sort pubs by proximity to today
  const sortedPubs = useMemo(() => [...pubs].sort((a,b) => a.startDate.localeCompare(b.startDate)), [pubs]);

  useEffect(() => {
    const p = person ? loadToneProfile(person) : null;
    setProfile(p);
  }, [person, showTone]);

  // When a calendar pub is selected → auto-fill topic + configure post type
  useEffect(() => {
    if (!selectedPubId) return;
    const pub = pubs.find(p => p.id === selectedPubId);
    if (!pub) return;
    const c = CMAP[pub.country];
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
        body: JSON.stringify({ topic, tone, focus, length, profile, language }),
      });
      const data = await res.json();
      if (data.ok && data.content) {
        setGenerated(data.content);
      } else {
        // Fallback to local generation if API fails
        setGenerated(buildGeneratedPost(topic, tone, focus, length, profile));
      }
    } catch {
      setGenerated(buildGeneratedPost(topic, tone, focus, length, profile));
    } finally {
      setIsGen(false);
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
    border:"1.5px solid var(--cal-border)",
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
          <div className="dm-surface" style={{
            background:"rgba(255,255,255,0.52)",
            border:"1.5px solid rgba(255,255,255,0.65)",
            borderRadius:18,
            padding:"22px 24px",
            boxShadow:"0 2px 16px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.85)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{
                width:28, height:28, borderRadius:9, background:"var(--accent)",
                display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                fontSize:13, fontWeight:800, color:"var(--accent-text)",
              }}>1</span>
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
          </div>

          {/* ── STEP 2: Topic ── */}
          <div className="dm-surface" style={{
            background:"rgba(255,255,255,0.52)",
            border:"1.5px solid rgba(255,255,255,0.65)",
            borderRadius:18, padding:"22px 24px",
            boxShadow:"0 2px 16px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.85)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{
                width:28, height:28, borderRadius:9, background:"var(--accent)",
                display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                fontSize:13, fontWeight:800, color:"var(--accent-text)",
              }}>2</span>
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
          </div>

          {/* ── STEP 3: Config ── */}
          <div className="dm-surface" style={{
            background:"rgba(255,255,255,0.52)",
            border:"1.5px solid rgba(255,255,255,0.65)",
            borderRadius:18, padding:"22px 24px",
            boxShadow:"0 2px 16px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.85)",
            display:"flex", flexDirection:"column", gap:20,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{
                width:28, height:28, borderRadius:9, background:"var(--accent)",
                display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                fontSize:13, fontWeight:800, color:"var(--accent-text)",
              }}>3</span>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Ajusta el estilo
              </span>
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
              <label style={{ ...labelSt, display:"flex", alignItems:"center", gap:6 }}>
                Tono
                {profile && <span style={{ fontSize:10, fontWeight:600, color:"var(--accent)", background:"rgba(var(--accent-rgb),0.12)", padding:"1px 7px", borderRadius:20, letterSpacing:"0.04em" }}>sobreescrito por perfil</span>}
              </label>
              <select style={{ ...inputSt, cursor:"pointer", opacity: profile ? 0.55 : 1 }}
                value={tone} onChange={e=>setTone(e.target.value)}
                disabled={!!profile} onFocus={onFocusFn} onBlur={onBlurFn}>
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
          </div>

          {/* ── STEP 4: Author / tone ── */}
          <div className="dm-surface" style={{
            background:"rgba(255,255,255,0.52)",
            border:"1.5px solid rgba(255,255,255,0.65)",
            borderRadius:18, padding:"22px 24px",
            boxShadow:"0 2px 16px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.85)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{
                width:28, height:28, borderRadius:9, background:"var(--accent)",
                display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                fontSize:13, fontWeight:800, color:"var(--accent-text)",
              }}>4</span>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
                Autor y tono personal
              </span>
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-muted)", fontWeight:500 }}>opcional</span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <select style={{ ...inputSt, flex:1, cursor:"pointer" }} value={person}
                onChange={e=>setPerson(e.target.value)} onFocus={onFocusFn} onBlur={onBlurFn}>
                <option value="">Sin tono personal</option>
                {PEOPLE.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <button type="button" onClick={()=>setShowTone(true)}
                style={{
                  height:48, padding:"0 16px", borderRadius:10, flexShrink:0,
                  border:`1.5px solid ${profile ? "rgba(var(--accent-rgb),0.50)" : "var(--cal-urlbar-border)"}`,
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
            {profile && (
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
          </div>

          {/* generate btn */}
          <button type="button" onClick={handleGenerate}
            disabled={!topic.trim() || isGen}
            className="ripple-effect hover-lift"
            style={{
              height:56, borderRadius:16,
              border: topic.trim() ? "1px solid var(--cal-urlbar-border)" : "1.5px solid var(--cal-border)",
              background: !topic.trim() ? "var(--cal-cell-bg)" : "var(--accent)",
              color: !topic.trim() ? "var(--text-muted)" : "var(--accent-text)",
              fontSize:16, fontFamily:"var(--font-sans)", fontWeight:700,
              cursor: !topic.trim() ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow: topic.trim() ? "var(--accent-glow), 0 4px 16px rgba(0,0,0,0.10)" : "none",
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
            <span style={{ fontSize:13, fontWeight:700, letterSpacing:"0.06em", color:"var(--text-primary)", textTransform:"uppercase", flex:1 }}>
              Post generado
            </span>
            <button type="button" onClick={handleGenerate}
              disabled={!topic.trim() || isGen}
              style={{
                height:38, padding:"0 16px", borderRadius:10,
                border:"1.5px solid var(--cal-border)",
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
          <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
            {!generated ? (
              <div style={{
                position:"absolute", inset:0,
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16,
                padding:32,
              }}>
                <div style={{
                  width:64, height:64, borderRadius:20,
                  background:"var(--cal-cell-bg)",
                  border:"1.5px solid var(--cal-urlbar-border)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 4px 20px rgba(0,0,0,0.08)",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>
                    {topic.trim() ? "Listo para generar" : "Configura tu post"}
                  </p>
                  <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, maxWidth:260 }}>
                    {topic.trim()
                      ? `Haz clic en "Generar post" y tu contenido aparecerá aquí listo para editar.`
                      : "Completa los pasos de la izquierda:\n1. Vincula una publicación del calendario\n2. Describe el tema\n3. Ajusta el estilo y genera."}
                  </p>
                </div>
                {topic.trim() && (
                  <button type="button" onClick={handleGenerate}
                    className="ripple-effect hover-lift"
                    style={{
                      height:40, padding:"0 20px", borderRadius:12,
                      border:"1px solid rgba(255,255,255,0.35)",
                      background:"var(--accent)", color:"var(--accent-text)",
                      fontSize:13, fontFamily:"var(--font-sans)", fontWeight:700,
                      cursor:"pointer", display:"flex", alignItems:"center", gap:7,
                      boxShadow:"var(--accent-glow)",
                    }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor"/>
                    </svg>
                    Generar post
                  </button>
                )}
              </div>
            ) : (
              <textarea
                style={{
                  width:"100%", height:"100%", padding:"32px 36px",
                  border:"none", background:"transparent",
                  color:"var(--text-primary)", fontSize:15.5, fontFamily:"var(--font-sans)",
                  lineHeight:1.85, resize:"none", outline:"none", fontWeight:450,
                }}
                value={generated}
                onChange={e=>setGenerated(e.target.value)}
              />
            )}
          </div>

          {/* bottom bar */}
          <div style={{
            padding:"14px 28px", borderTop:"1px solid var(--cal-border)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            background:"var(--cal-header-bg)", flexShrink:0,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, color: generated.length > 2800 ? "#dc2626" : "var(--text-secondary)", fontFamily:"var(--font-sans)", fontWeight:500 }}>
                {generated.length} <span style={{ color:"var(--text-muted)" }}>/ 3000</span>
              </span>
              {generated.length > 2800 && (
                <span style={{ fontSize:12, color:"#dc2626", fontWeight:600 }}>Cerca del límite</span>
              )}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={()=>setShowSave(true)} disabled={!generated}
                className="ripple-effect hover-lift"
                style={{
                  height:42, padding:"0 18px", borderRadius:11,
                  border:`1.5px solid ${generated ? "rgba(var(--accent-rgb),0.40)" : "var(--cal-border)"}`,
                  background: generated ? "rgba(var(--accent-rgb),0.10)" : "var(--cal-cell-bg)",
                  color: generated ? "var(--accent)" : "var(--text-muted)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: !generated ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", gap:7,
                  opacity: !generated ? 0.5 : 1,
                  boxShadow: generated ? "0 2px 10px rgba(var(--accent-rgb),0.18)" : "none",
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
                  height:42, padding:"0 20px", borderRadius:11,
                  border:"1.5px solid rgba(10,102,194,0.45)",
                  background: generated ? "rgba(10,102,194,0.14)" : "var(--cal-cell-bg)",
                  color: generated ? "#0A66C2" : "var(--text-muted)",
                  fontSize:14, fontFamily:"var(--font-sans)", fontWeight:700,
                  cursor: !generated ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", gap:8,
                  opacity: !generated ? 0.5 : 1,
                  boxShadow: generated ? "0 2px 14px rgba(10,102,194,0.22)" : "none",
                  transition:"all 180ms",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Publicar en LinkedIn
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTone && (
        <ToneAdapterModal
          initialPerson={person}
          onClose={()=>setShowTone(false)}
        />
      )}

      {/* ── Save post modal ── */}
      {showSave && (
        <SavePostModal
          person={person}
          topic={cleanTopic}
          preview={generated}
          saveStatus={saveStatus}
          savedFile={savedFile}
          onSave={handleSavePost}
          onClose={()=>{ if(saveStatus==="saving") return; setShowSave(false); setSaveStatus("idle"); }}
        />
      )}
    </>
  );
}

// ── MacWindow ─────────────────────────────────────────────────────────────────

function MacWindow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      borderRadius:22, overflow:"hidden",
      border:"1px solid var(--glass-border)",
      background:"var(--cal-window-bg)",
      backdropFilter:"blur(80px) saturate(250%)",
      WebkitBackdropFilter:"blur(80px) saturate(250%)",
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
              width:13, height:13, borderRadius:"50%", background:col,
              boxShadow:`inset 0 0.5px 0 rgba(0,0,0,0.18), 0 1px 4px ${col}88`,
            }} />
          ))}
        </div>
        <div style={{
          flex:1, maxWidth:380, margin:"0 auto",
          height:24, borderRadius:8,
          background:"var(--cal-urlbar-bg)",
          border:"1px solid var(--cal-urlbar-border)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:500, color:"var(--text-muted)",
          fontFamily:"var(--font-sans)",
          letterSpacing:"0.01em",
        }}>
          linkedin-calendar.local
        </div>
        <div style={{ width:82 }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        {children}
      </div>
    </div>
  );
}

// ── FloatingOrbs ──────────────────────────────────────────────────────────────

function FloatingOrbs() {
  const orbs = [
    { top:"8%",   left:"6%",   w:200, h:200, delay:"0s",   dur:"8s",  anim:"float",    op:0.45 },
    { top:"65%",  right:"7%",  w:140, h:140, delay:"1.8s", dur:"10s", anim:"floatAlt", op:0.38 },
    { top:"45%",  right:"3%",  w:80,  h:80,  delay:"3.5s", dur:"7s",  anim:"float",    op:0.30 },
    { top:"25%",  right:"18%", w:55,  h:55,  delay:"0.8s", dur:"9s",  anim:"floatAlt", op:0.35 },
    { bottom:"12%",left:"4%",  w:70,  h:70,  delay:"2.2s", dur:"11s", anim:"float",    op:0.28 },
    { top:"78%",  left:"30%",  w:45,  h:45,  delay:"4s",   dur:"6s",  anim:"floatAlt", op:0.25 },
  ] as const;

  return (
    <div aria-hidden="true" style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
      {orbs.map((o, i) => (
        <div key={i} style={{
          position:"absolute",
          ...("top" in o ? { top:o.top } : {}),
          ...("bottom" in o ? { bottom:(o as {bottom:string}).bottom } : {}),
          ...("left" in o ? { left:(o as {left:string}).left } : {}),
          ...("right" in o ? { right:(o as {right:string}).right } : {}),
          width:o.w, height:o.h, borderRadius:"50%",
          background:"rgba(255,255,255,0.14)",
          backdropFilter:"blur(20px) saturate(160%)",
          WebkitBackdropFilter:"blur(20px) saturate(160%)",
          border:"1.5px solid rgba(255,255,255,0.30)",
          boxShadow:"0 8px 32px rgba(255,255,255,0.15), inset 0 1.5px 0 rgba(255,255,255,0.45)",
          opacity:o.op,
          animation:`${o.anim} ${o.dur} ease-in-out infinite ${o.delay}`,
        }} />
      ))}
    </div>
  );
}

// ── CalendarPage ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [dark,      setDark]      = useState(false);
  const [activeTab, setActiveTab] = useState<"calendar"|"create">("calendar");
  const [createPubId, setCreatePubId] = useState("");
  const [filter, setFilter] = useState<CountryKey>("LATAM");
  const [year,   setYear]   = useState(() => TODAY.getFullYear());
  const [month,  setMonth]  = useState(() => TODAY.getMonth());
  const [pubs,   setPubs]   = useState<Publication[]>(SEED);
  const [modal,  setModal]  = useState<ModalState>({ mode:"closed" });

  const todayStr = toDateStr(TODAY);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    fetch("/api/publications")
      .then(r => r.json())
      .then((data: Publication[]) => { if (Array.isArray(data) && data.length > 0) setPubs(data); })
      .catch(() => {});
  }, []);

  const visiblePubs = useMemo(() => pubs.filter(p => filter === "LATAM" || p.country === filter), [pubs, filter]);
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); }

  function savePub(p: Publication) {
    setPubs(prev => {
      const i = prev.findIndex(x => x.id === p.id);
      return i >= 0 ? prev.map((x, idx) => idx === i ? p : x) : [...prev, p];
    });
    fetch("/api/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).catch(() => {});
  }

  function deletePub(id: string) {
    setPubs(prev => prev.filter(p => p.id !== id));
    setModal({ mode:"closed" });
    fetch("/api/publications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
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
      <FloatingOrbs />

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
            <div style={{ display:"flex", gap:3, background:"var(--cal-cell-bg)", borderRadius:12, padding:4, border:"1px solid var(--cal-border)" }}>
              {([
                { id:"calendar" as const, label:"Calendario",      icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
                { id:"create"   as const, label:"Crea tu post",  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
              ] as const).map(tab => (
                <button key={tab.id} type="button" onClick={()=>setActiveTab(tab.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:7,
                    height:34, padding:"0 18px", borderRadius:9, border:"none",
                    background: activeTab===tab.id ? "var(--accent)" : "transparent",
                    color: activeTab===tab.id ? "var(--accent-text)" : "var(--text-secondary)",
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
          </div>

          {/* Right controls */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {activeTab === "calendar" && (
              <>
                <GlassBtn onClick={() => setModal({ mode:"create", date:todayStr })} accent>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Nuevo post
                </GlassBtn>
                <CountryDropdown selected={filter} onChange={setFilter} />
              </>
            )}
            <GlassBtn onClick={() => setDark(!dark)} small aria-label={dark ? "Light mode" : "Dark mode"}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </GlassBtn>
          </div>
        </div>

        {activeTab === "create" && <PostCreator dark={dark} pubs={pubs} initialPubId={createPubId} key={createPubId} />}

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
            <div style={{ display:"flex", gap:6, alignSelf:"center", marginTop:2 }}>
              {[
                { fn: prevMonth, label:"Previous month", d:"M7 1L1 6.5L7 12" },
                { fn: nextMonth, label:"Next month",     d:"M1 1L7 6.5L1 12" },
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
                color: i===0||i===6 ? "var(--text-muted)" : "var(--text-secondary)",
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
                            opacity: inMonth ? 1 : 0.30,
                            boxShadow: isToday ? "0 2px 10px rgba(var(--accent-rgb),0.45)" : "none",
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
                            border:`1px solid rgba(255,255,255,0.20)`,
                            borderRadius:6,
                            cursor:"pointer", fontSize:11,
                            fontFamily:"var(--font-sans)", fontWeight:600,
                            overflow:"hidden", whiteSpace:"nowrap",
                            display:"flex", alignItems:"center",
                            padding:"0 6px", gap:4,
                            boxShadow:"0 4px 12px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.55)",
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
          padding:"7px 20px", borderTop:"1px solid rgba(255,255,255,0.10)",
          background:"var(--cal-statusbar-bg)",
          fontSize:12, fontWeight:500, letterSpacing:"0.01em",
          color:"var(--text-secondary)", flexShrink:0,
        }}>
          <span>
            {visiblePubs.length} post{visiblePubs.length!==1?"s":""}
            <span style={{ color:"var(--text-muted)", margin:"0 6px" }}>·</span>
            {filter==="LATAM" ? "Todos los mercados" : CMAP[filter].label}
          </span>
          <span style={{ color:"var(--text-muted)" }}>Haz clic en cualquier día para planificar</span>
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
        />
      )}
    </div>
  );
}
