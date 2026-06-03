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

const DAYS        = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_ABR  = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

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
function formatDisplayDate(ds: string): string {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
          backdropFilter:"blur(10px) saturate(160%)",
          WebkitBackdropFilter:"blur(10px) saturate(160%)",
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
        backdropFilter:"blur(14px) saturate(200%)",
        WebkitBackdropFilter:"blur(14px) saturate(200%)",
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
        backdropFilter: "blur(30px) saturate(200%)",
        WebkitBackdropFilter: "blur(30px) saturate(200%)",
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
                background: selected === co.key ? "rgba(255,255,255,0.28)" : "transparent",
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
    backdropFilter:"blur(20px) saturate(180%)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
    boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.22)",
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
              backdropFilter:"blur(10px)",
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
        placeholder={people.length === 0 ? "Search people…" : "Add more…"}
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
            {people.length} selected · Esc to close
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
        backdropFilter:"blur(20px)",
        boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.22)",
      }}>
        <button type="button" onClick={() => openFor("start")} style={{
          padding:"10px 14px", border:"none",
          background: open && picking==="start" ? "var(--accent-dim)" : "transparent",
          cursor:"pointer", textAlign:"left", outline:"none", transition:"background 150ms",
        }}>
          <div style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700,
            color: open && picking==="start" ? "var(--accent)" : "var(--text-secondary)", marginBottom:3 }}>From</div>
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
          <div style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700,
            color: open && picking==="end" ? "var(--accent)" : "var(--text-secondary)", marginBottom:3 }}>To</div>
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
            {picking === "start" ? "Pick start, then end date" : "Now pick the end date"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PublicationModal ──────────────────────────────────────────────────────────

function PublicationModal({ state, dark, onSave, onDelete, onClose, onEdit }: {
  state: Exclude<ModalState, { mode: "closed" }>;
  dark: boolean;
  onSave: (p: Publication) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onEdit: (pub: Publication) => void;
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
    try { await navigator.clipboard.writeText(content || title); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch (_) {}
    window.open("https://www.linkedin.com/feed/", "_blank", "noopener,noreferrer");
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 14px", borderRadius:10,
    border:"1.5px solid var(--cal-border)",
    background:"var(--cal-cell-bg)",
    backdropFilter:"blur(20px) saturate(180%)",
    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)",
    outline:"none", transition:"border-color 180ms, box-shadow 180ms",
    boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.22)",
  };

  const labelStyle: React.CSSProperties = {
    display:"block", marginBottom:6, fontSize:12,
    fontFamily:"var(--font-sans)", fontWeight:600,
    letterSpacing:"0.06em", textTransform:"uppercase",
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
                {isCreate ? "New publication" : "Edit publication"}
              </h2>
            )}
          </div>

          <button type="button" onClick={onClose} aria-label="Close"
            className="hover-lift"
            style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              width:32, height:32, borderRadius:9,
              background:"rgba(255,255,255,0.22)",
              border:"1px solid rgba(255,255,255,0.35)",
              backdropFilter:"blur(10px)",
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
              background:"rgba(255,255,255,0.18)",
              border:"1px solid rgba(255,255,255,0.32)",
              backdropFilter:"blur(10px)",
              fontSize:14, fontWeight:400, lineHeight:1.75, color:"var(--text-primary)",
              whiteSpace:"pre-wrap", maxHeight:200, overflowY:"auto",
              boxShadow:"inset 0 1.5px 0 rgba(255,255,255,0.28)",
            }}>
              {existing?.content || (
                <span style={{ color:"var(--text-muted)", fontStyle:"italic" }}>
                  No content yet — click Generate post to create a template.
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
                    backdropFilter:"blur(10px)",
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
                  {copied ? "Copied! Paste on LinkedIn" : "Post on LinkedIn"}
                </button>

                <button type="button"
                  onClick={() => { onEdit({ ...existing!, content: generatePost(existing!) }); }}
                  className="ripple-effect hover-lift"
                  style={{
                    flex:1, height:42, borderRadius:12,
                    border:"1.5px solid rgba(255,255,255,0.40)",
                    background:"rgba(255,255,255,0.20)",
                    backdropFilter:"blur(15px)",
                    color:"var(--text-primary)", fontSize:14, fontFamily:"var(--font-sans)", fontWeight:600,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                    cursor:"pointer",
                    boxShadow:"var(--shadow-btn)", transition:"opacity 150ms, transform 240ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  ✦ Generate post
                </button>
              </div>

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button type="button" onClick={() => onDelete(existing!.id)}
                  className="ripple-effect"
                  style={{
                    padding:"7px 14px", borderRadius:9, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:500, cursor:"pointer",
                    border:"1px solid rgba(239,68,68,0.30)", background:"rgba(239,68,68,0.10)",
                    backdropFilter:"blur(10px)", color:"#dc2626",
                    transition:"opacity 150ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  Delete
                </button>
                <button type="button" onClick={() => onEdit(existing!)}
                  className="ripple-effect hover-lift"
                  style={{
                    padding:"7px 16px", borderRadius:9, fontSize:13, fontFamily:"var(--font-sans)", fontWeight:600, cursor:"pointer",
                    border:"1.5px solid rgba(255,255,255,0.40)", background:"rgba(255,255,255,0.20)",
                    backdropFilter:"blur(15px)", color:"var(--text-primary)",
                    boxShadow:"var(--shadow-btn)", transition:"opacity 150ms, transform 240ms",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.78"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  Edit
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
                    backdropFilter:"blur(10px)", color:"#dc2626",
                  }}
                >
                  Delete
                </button>
              ) : <div />}

              <div style={{ display:"flex", gap:8 }}>
                <GlassBtn onClick={onClose}>Cancel</GlassBtn>
                <GlassBtn onClick={handleSave} accent disabled={!title.trim()}>
                  {isCreate ? "Add publication" : "Save changes"}
                </GlassBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
        backdropFilter:"blur(20px)",
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
          backdropFilter:"blur(10px)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:500, color:"var(--text-muted)",
          fontFamily:"var(--font-sans)",
          letterSpacing:"0.01em",
        }}>
          linkedin-calendar.local
        </div>
        <div style={{ width:82 }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
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
    <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
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
  const [dark,   setDark]   = useState(false);
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
          padding:"0 20px", height:54, flexShrink:0,
          borderBottom:"1px solid var(--cal-border)",
          background:"var(--cal-toolbar-bg)",
          gap:12,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span style={{ fontSize:13, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-secondary)", textTransform:"uppercase" }}>
                Calendar
              </span>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <GlassBtn onClick={() => setModal({ mode:"create", date:todayStr })} accent>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New post
            </GlassBtn>
            <CountryDropdown selected={filter} onChange={setFilter} />
            <GlassBtn onClick={() => setDark(!dark)} small aria-label={dark ? "Light mode" : "Dark mode"}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </GlassBtn>
          </div>
        </div>

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
                    backdropFilter:"blur(20px) saturate(160%)",
                    WebkitBackdropFilter:"blur(20px) saturate(160%)",
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
              aria-label={["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][i]}
              style={{
                padding:"7px 0", textAlign:"center",
                fontSize:11, fontWeight:700, letterSpacing:"0.08em",
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
          style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
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
                        aria-label={day.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
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
                            backdropFilter:"blur(14px) saturate(200%)",
                            WebkitBackdropFilter:"blur(14px) saturate(200%)",
                            border:`1px solid rgba(255,255,255,0.30)`,
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
            {filter==="LATAM" ? "All markets" : CMAP[filter].label}
          </span>
          <span style={{ color:"var(--text-muted)" }}>Click any day to schedule</span>
        </div>
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
        />
      )}
    </div>
  );
}
