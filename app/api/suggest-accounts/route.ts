import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Sugiere hasta 10 cuentas de LinkedIn para seguir, según el TEMA del post (ICP) y el PAÍS (calendario).
//
// 1. Apollo People Search (gratis) → candidatos por cargo/seniority/industria/país.
// 2. Caché en Supabase: si la persona ya se resolvió antes → se reutiliza GRATIS.
// 3. Apollo Bulk Enrichment (solo para los nuevos) → nombre + apellido completo + URL directa del perfil.
//    Cada persona consume 1 crédito UNA sola vez; luego queda cacheada.
//
// Variables de entorno en .env.local:
//   APOLLO_API_KEY            → Apollo dashboard → Settings → API
//   SUPABASE_SERVICE_ROLE_KEY → caché de personas resueltas

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

const supabase = createClient(
  "https://kbtbqsglagdurlqtlnww.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- ICPs: cargos objetivo según el área ---
const GROWTH_TITLES = [
  "Head of Product",
  "Product Manager",
  "Head of Marketing",
  "CMO",
  "Head of Growth",
  "Head of Operations",
  "Head of Digital Channels",
  "Head of Digital Transformation",
];

const RISK_TITLES = [
  "Head of Risk",
  "Chief Risk Officer",
  "Head of Compliance",
  "Compliance Officer",
  "Chief Compliance Officer",
  "Head of Legal",
  "General Counsel",
  "Head of Onboarding",
  "Head of Digital Transformation",
];

// ICP "mixto": combina cargos de growth y de risk (para temas transversales).
const MIXED_TITLES = [...new Set([...GROWTH_TITLES, ...RISK_TITLES])];

// --- Mapeo: producto (seleccionado en la tarjeta del calendario) → cargos ICP ---
const PRODUCT_TO_TITLES: Record<string, string[]> = {
  "WA Onboarding": GROWTH_TITLES,
  "Onboarding (General)": GROWTH_TITLES,
  "WA Banking": GROWTH_TITLES,
  "WA Agentic": GROWTH_TITLES,
  "Digital Identity": MIXED_TITLES,
  "Firma Digital": MIXED_TITLES,
  "Background Checks": RISK_TITLES,
  "Fraude": RISK_TITLES,
  // Post general sobre Truora: igual recomienda ICPs, con audiencia mixta.
  "About Truora": MIXED_TITLES,
};

// --- Mapeo: país del calendario → ubicaciones de Apollo ---
const ALL_LATAM = ["Colombia", "Mexico", "Peru", "Chile", "Argentina"];
const COUNTRY_TO_LOCATIONS: Record<string, string[]> = {
  LATAM: ALL_LATAM,
  CO: ["Colombia"],
  MX: ["Mexico"],
  PE: ["Peru"],
  CL: ["Chile"],
  AR: ["Argentina"],
};

const SENIORITIES = ["head", "manager", "senior", "vp", "c_suite"];
const KEYWORD_TAGS = ["fintech", "payments", "banking", "financial services"];

type Suggestion = {
  apolloId: string;
  category: string;
  icpGroup: "growth" | "risk" | "mixed";
  industryTags: string[];
  country: string;
  name: string;            // nombre + apellido completo (tras enrichment)
  title: string;
  seniority: string;
  headline: string;
  company: string;
  companyDomain: string;
  emailStatus: string;
  linkedinUrl: string | null;     // URL directa al perfil (tras enrichment)
  linkedinSearchUrl: string;      // respaldo: búsqueda en LinkedIn
};

type ApolloPerson = {
  id: string;
  first_name: string;
  title: string;
  seniority?: string;
  headline?: string;
  email_status?: string;
  organization?: { name?: string; primary_domain?: string };
};

type ApolloMatch = { name?: string; linkedin_url?: string; headline?: string } | null;

function icpGroupFor(category: string): "growth" | "risk" | "mixed" {
  const titles = PRODUCT_TO_TITLES[category] ?? GROWTH_TITLES;
  if (titles === MIXED_TITLES) return "mixed";
  return titles === RISK_TITLES ? "risk" : "growth";
}

async function apolloSearch(filters: object, perPage: number, page: number): Promise<ApolloPerson[]> {
  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": APOLLO_API_KEY! },
    body: JSON.stringify({ ...filters, per_page: perPage, page }),
  });
  if (!res.ok) throw new Error(`Apollo search falló: ${res.status}`);
  const json = await res.json();
  return json.people ?? [];
}

// Enriquece por Apollo ID (máx 10 por llamada). Devuelve los matches en el mismo orden.
async function apolloBulkMatch(ids: string[]): Promise<ApolloMatch[]> {
  const res = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY! },
    body: JSON.stringify({ details: ids.map((id) => ({ id })) }),
  });
  if (!res.ok) return ids.map(() => null);
  const json = await res.json();
  return json.matches ?? ids.map(() => null);
}

function linkedinSearchUrl(name: string, company: string): string {
  const keywords = [name, company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

// POST → body: { category, country, limit }
export async function POST(request: Request) {
  try {
    if (!APOLLO_API_KEY) {
      return NextResponse.json({ error: "Falta APOLLO_API_KEY en .env.local" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const category: string = body.category ?? "Digital Identity";
    const country: string = body.country ?? "LATAM";
    const publicationId: string = body.publicationId || "default";
    const limit = Math.min(body.limit ?? 10, 25);
    const icpGroup = icpGroupFor(category);

    const filters = {
      person_titles: PRODUCT_TO_TITLES[category] ?? GROWTH_TITLES,
      person_seniorities: SENIORITIES,
      q_organization_keyword_tags: KEYWORD_TAGS,
      person_locations: COUNTRY_TO_LOCATIONS[country] ?? ALL_LATAM,
    };

    // ── Rotación por publicación, sin repetir, MISMA por país+tema ──
    // A cada publicación (tarjeta) se le asigna un "bloque" (página) distinto dentro del
    // país+tema (scope). Reabrir la misma publicación → mismo bloque (estable y compartido
    // por el equipo). Nueva publicación → siguiente bloque sin repetir. Al agotar el pool, reinicia.
    const scope = `${country}|${category}`;
    const pubKey = `${scope}|${publicationId}`;

    let page: number;
    const { data: existing } = await supabase
      .from("suggestion_assignments")
      .select("page")
      .eq("pub_key", pubKey)
      .maybeSingle();

    if (existing) {
      page = existing.page;
    } else {
      const { data: scopeRows } = await supabase
        .from("suggestion_assignments")
        .select("page")
        .eq("scope", scope)
        .order("page", { ascending: false })
        .limit(1);
      page = (scopeRows?.[0]?.page ?? 0) + 1;
      await supabase.from("suggestion_assignments").upsert({ pub_key: pubKey, scope, page }, { onConflict: "pub_key" });
    }

    let people = await apolloSearch(filters, limit, page);

    // Pool agotado → reinicia el ciclo del país+tema desde el primer bloque
    if (people.length === 0 && page > 1) {
      await supabase.from("suggestion_assignments").delete().eq("scope", scope);
      page = 1;
      await supabase.from("suggestion_assignments").upsert({ pub_key: pubKey, scope, page }, { onConflict: "pub_key" });
      people = await apolloSearch(filters, limit, page);
    }

    const ids = people.map((p) => p.id);

    // 1. Caché: personas ya resueltas → gratis
    const cache = new Map<string, { full_name: string; linkedin_url: string | null }>();
    if (ids.length) {
      const { data: cachedRows } = await supabase
        .from("account_suggestions")
        .select("apollo_id, full_name, linkedin_url")
        .in("apollo_id", ids)
        .eq("resolved", true);
      for (const r of cachedRows ?? []) cache.set(r.apollo_id, { full_name: r.full_name, linkedin_url: r.linkedin_url });
    }

    // 2. Enriquecer los que NO están en caché (en lotes de 10) → consume créditos solo aquí
    const toEnrich = people.filter((p) => !cache.has(p.id));
    const enriched = new Map<string, { name: string; linkedin_url: string | null; headline: string }>();
    for (let i = 0; i < toEnrich.length; i += 10) {
      const batch = toEnrich.slice(i, i + 10);
      const matches = await apolloBulkMatch(batch.map((p) => p.id));
      const rows = batch.map((p, idx) => {
        const m = matches[idx] ?? {};
        const company = p.organization?.name ?? "";
        const fullName = m?.name ?? p.first_name;
        const url = m?.linkedin_url ?? null;
        enriched.set(p.id, { name: fullName, linkedin_url: url, headline: m?.headline ?? p.headline ?? "" });
        return {
          apollo_id: p.id,
          category,
          icp_group: icpGroup,
          industry_tags: KEYWORD_TAGS,
          country,
          first_name: p.first_name,
          full_name: fullName,
          title: p.title,
          seniority: p.seniority ?? "",
          headline: m?.headline ?? p.headline ?? "",
          company,
          company_domain: p.organization?.primary_domain ?? "",
          email_status: p.email_status ?? "",
          linkedin_url: url,
          resolved: !!url,
          updated_at: new Date().toISOString(),
        };
      });
      if (rows.length) await supabase.from("account_suggestions").upsert(rows, { onConflict: "apollo_id" });
    }

    // 3. Armar la respuesta en el orden de la búsqueda, con nombre completo + link directo
    const suggestions: Suggestion[] = people.map((p) => {
      const company = p.organization?.name ?? "";
      const c = cache.get(p.id);
      const e = enriched.get(p.id);
      const fullName = c?.full_name ?? e?.name ?? p.first_name;
      const linkedinUrl = c?.linkedin_url ?? e?.linkedin_url ?? null;
      return {
        apolloId: p.id,
        category,
        icpGroup,
        industryTags: KEYWORD_TAGS,
        country,
        name: fullName,
        title: p.title,
        seniority: p.seniority ?? "",
        headline: e?.headline ?? p.headline ?? "",
        company,
        companyDomain: p.organization?.primary_domain ?? "",
        emailStatus: p.email_status ?? "",
        linkedinUrl,
        linkedinSearchUrl: linkedinSearchUrl(fullName, company),
      };
    });

    return NextResponse.json({ category, country, suggestions });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
