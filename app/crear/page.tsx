"use client";

import { useState, useEffect } from "react";
import { PostCreator, MacWindow, type Publication } from "../page";

// Página independiente: solo el creador de posts.
// Pensada para compartir el link directo (/crear) con alguien que únicamente
// necesita redactar y publicar, sin ver el calendario completo.
export default function CrearPage() {
  const [dark, setDark] = useState(true);
  const [pubs, setPubs] = useState<Publication[]>([]);

  // Tema según el sistema (igual que la pantalla principal)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Carga las publicaciones para que el "Vincular al calendario" siga siendo opcional.
  useEffect(() => {
    fetch("/api/publications")
      .then(r => r.json())
      .then((data: Publication[]) => { if (Array.isArray(data) && data.length > 0) setPubs(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      height:"100svh", display:"flex", flexDirection:"column",
      padding:"12px", position:"relative", zIndex:1,
    }}>
      <MacWindow>
        {/* ── Toolbar mínima ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 24px", height:62, flexShrink:0,
          borderBottom:"1px solid var(--cal-border)",
          background:"var(--cal-toolbar-bg)",
          gap:12,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)" style={{ flexShrink:0 }}>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
              Crea tu post
            </span>
            <span style={{
              fontSize:11, fontWeight:600, color:"var(--accent)",
              background:"rgba(var(--accent-rgb),0.12)", padding:"2px 9px", borderRadius:20,
              border:"1px solid rgba(var(--accent-rgb),0.20)",
            }}>
              LinkedIn · Truora
            </span>
          </div>

          <button type="button" onClick={()=>setDark(!dark)}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              width:34, height:34, borderRadius:8, flexShrink:0,
              border:"1px solid var(--cal-border)",
              background:"var(--cal-cell-bg)", color:"var(--text-primary)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer",
            }}>
            {dark
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>

        <PostCreator dark={dark} pubs={pubs} />
      </MacWindow>
    </div>
  );
}
