# LinkedIn Calendar — LATAM Content Planner

Herramienta interna de Truora para planificar y generar contenido de LinkedIn en LATAM. Combina un calendario visual mensual, generación de posts con IA (Claude u OpenAI), perfiles de tono personalizados por autor, y un **sistema de sugerencias de cuentas (ICPs) para seguir** basado en Apollo.io — segmentado por producto/tema y país, con rotación sin repetir entre publicaciones.

> 📘 **¿Acabas de hacer fork?** Empieza por [`CONTEXT.md`](./CONTEXT.md) — contexto completo: quiénes son los ICPs, secuencia de pasos de cada flujo, cómo funciona la app y cómo la estrategia "llega a todo" el mercado objetivo. Este README cubre el detalle técnico.

---

## Contexto del proyecto

**Empresa:** Truora Inc.
**Mercados:** Colombia, Perú, Chile, México, Argentina.
**Usuarios:** Equipo de marketing y Growth de Truora — las personas que gestionan las cuentas de LinkedIn de la empresa y de sus voceros.

### El problema que resuelve

El equipo de contenido de Truora publica regularmente en LinkedIn para audiencias del sector financiero (bancos, fintechs, sofoms, lenders, wallets). El desafío es doble:

1. **Consistencia de calendario**: coordinar qué se publica, cuándo y en qué mercado, sin perder el hilo de lo que ya está planeado.
2. **Consistencia de voz**: cada persona del equipo tiene su estilo de escritura. Cuando la IA genera un borrador, tiene que sonar como esa persona, no como un bot corporativo.

### Cómo lo resuelve

- El **calendario** permite ver de un vistazo todas las publicaciones planeadas por país, asignar personas y vincular contenido directamente a cada fecha.
- El **generador de posts** usa un system prompt con el estilo editorial de Truora (conversacional, directo, con Spanglish, sin guiones largos) para que GPT-4o genere borradores listos para editar, no para reescribir desde cero.
- Los **perfiles de tono** capturan el estilo real de cada persona (emojis, hashtags, preguntas retóricas, vocabulario frecuente) y los aplican al momento de generar.
- El botón **"Publicar en LinkedIn"** abre el compositor de LinkedIn con el texto ya cargado.
- Las **sugerencias de ICPs** muestran, al generar/crear una publicación, hasta 10 cuentas de LinkedIn relevantes a seguir según el **producto/tema** del post y el **país** de la tarjeta del calendario — con nombre completo y link directo al perfil.

### Audiencia objetivo del contenido generado

CMOs, Heads of Growth, Product Owners, Product Managers y líderes de negocio en el sector financiero de LATAM. La propuesta de valor de Truora que el contenido comunica es: confianza digital simple, segura y con menos fricción.

---

## Qué hace la app

### Calendario de publicaciones
- Vista mensual con grilla de 7 columnas
- Filtro por país: LATAM, Colombia, Argentina, Perú, Chile, México
- Publicaciones multi-día con continuidad visual
- Chips con color por país, título y personas asignadas
- Modal para crear, ver y editar publicaciones con selector de rango de fechas
- Indicador del día de hoy

### Generador de posts ("Crea tu post")
Flujo guiado de 4 pasos:
1. Vincular a una publicación del calendario (opcional)
2. Describir el tema del post
3. Ajustar parámetros: idioma, longitud, tono, foco
4. Seleccionar autor y adaptar tono personal

Parámetros disponibles:
- **Idiomas**: Español, Inglés, Português
- **Longitud**: Corto (1-2 párrafos), Medio (3-4), Largo (5+)
- **Tono**: Profesional, Conversacional, Inspiracional, Educativo, Directo, Storytelling
- **Foco**: Reconocimiento de marca, Liderazgo de pensamiento, Generación de leads, Engagement, Educativo, Anuncio, Historia personal

La generación usa un system prompt en español de más de 250 líneas con el estilo editorial de Truora. El proveedor de IA es **configurable**: si existe `ANTHROPIC_API_KEY` usa **Claude** (`claude-sonnet-4-6` por defecto); si no, cae a **OpenAI GPT-4o** con `OPENAI_API_KEY`. Si ambas fallan, la app genera un post localmente usando plantillas por estilo y foco.

Al **generar el post** se abre automáticamente el popup de **sugerencias de ICPs** (ver abajo); el tema se infiere del contenido o se toma del producto de la tarjeta vinculada, y el país sale del calendario.

### Sugerencias de cuentas para seguir (ICPs)
Popup que sugiere hasta **10 cuentas de LinkedIn para seguir**, alineadas al contenido:

- **Tema/producto → ICP**: cada producto de Truora mapea a un grupo de cargos objetivo.
  - `WA Onboarding`, `WA Banking`, `WA Agentic` → **Growth/Producto** (Head of Product, CMO, Head of Growth, Operaciones, Canales digitales, Transformación digital).
  - `Background Checks` → **Riesgo/Compliance** (Head of Risk/Compliance/Legal, CRO, CCO, General Counsel, Onboarding).
  - `Digital Identity` → **ambos** grupos combinados.
- **País → ubicación**: lo da la tarjeta del calendario (`LATAM` busca en los 5 países; `CO/MX/PE/CL/AR` filtra ese país).
- **Seniority**: Head, Manager, Senior, VP, C-level.
- **Datos por persona**: nombre + apellido completo, cargo, empresa y **link directo al perfil de LinkedIn** (si no se resuelve, cae a un link de búsqueda con su nombre).
- **Rotación por publicación, sin repetir**: a cada publicación se le asigna un "bloque" distinto dentro de su país+tema. Reabrir la misma publicación → misma lista (estable y compartida por el equipo de ese país). Una publicación nueva → siguiente bloque, sin repetir a quien ya salió. Al agotar el pool, el ciclo reinicia.
- **Caché de créditos**: cada persona se enriquece en Apollo **una sola vez** (1 crédito de por vida) y queda en la tabla `account_suggestions`; reapariciones futuras son gratis.

### Perfiles de tono
- Cada persona del equipo puede tener un perfil que captura su estilo de escritura real
- El perfil se crea pegando 3-6 posts de LinkedIn propios separados por `---`
- La app analiza: uso de emojis, hashtags, preguntas, listas, palabras promedio por post, estilo dominante
- Los perfiles se guardan en `localStorage` bajo `tone_${nombrePersona}`
- Al generar un post con perfil activo, el tono genérico se desactiva y se usa el perfil
- Los perfiles también se persisten como archivos `.md` en `/tone_profiles/`

### Guardado de posts
- Las publicaciones se guardan en Supabase (PostgreSQL)
- Los posts generados pueden guardarse en el archivo de perfil de la persona correspondiente
- Modal de guardado permite elegir a qué perfil asociar el post

---

## Stack y arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Estilos | Tailwind CSS 4, CSS variables, Geist font, tema claro/oscuro según el sistema |
| Backend | Next.js API Routes (4 endpoints) |
| Base de datos | Supabase (PostgreSQL) |
| IA (generador) | Claude (Anthropic) o OpenAI GPT-4o — configurable |
| Lead-gen / ICPs | Apollo.io (People Search + Bulk Enrichment) |
| Deploy | Vercel |

### API Routes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/generate-post` | POST | Genera un post con Claude (Anthropic) o, si no, OpenAI GPT-4o |
| `/api/publications` | GET / POST / DELETE | CRUD de publicaciones en Supabase |
| `/api/save-post` | POST | Agrega el post generado al archivo `.md` de perfil |
| `/api/suggest-accounts` | POST | Sugiere ICPs vía Apollo (búsqueda + enrichment), con caché y rotación por publicación |
| `/api/tone-profile` | GET / POST | Lista/lee perfiles de tono guardados en `/tone_profiles/` |

**`POST /api/suggest-accounts`** — body: `{ category, country, publicationId, limit? }`
- `category`: `"WA Onboarding" | "WA Banking" | "WA Agentic" | "Digital Identity" | "Background Checks"`
- `country`: `"LATAM" | "CO" | "MX" | "PE" | "CL" | "AR"`
- `publicationId`: id de la tarjeta (clave de rotación; estable por publicación)
- Respuesta: `{ category, country, suggestions: Suggestion[] }`

### Modelos de datos

```typescript
interface Publication {
  id: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  title: string;
  content: string;
  country: "LATAM" | "CO" | "AR" | "PE" | "CL" | "MX";
  category?: ProductCategory;   // producto/tema → define el ICP a sugerir
  people: string[];
}

// Producto seleccionado en la tarjeta del calendario
type ProductCategory =
  | "WA Onboarding" | "WA Banking" | "WA Agentic"
  | "Digital Identity" | "Background Checks";

// Una cuenta sugerida para seguir (respuesta de /api/suggest-accounts)
interface Suggestion {
  apolloId: string;
  category: string;
  icpGroup: "growth" | "risk" | "mixed";
  country: string;
  name: string;                 // nombre + apellido completo
  title: string;
  company: string;
  linkedinUrl: string | null;   // link directo al perfil (tras enrichment)
  linkedinSearchUrl: string;    // respaldo: búsqueda en LinkedIn por nombre
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
```

---

## Estructura de archivos

```
linkedin-calendar/
├── app/
│   ├── api/
│   │   ├── generate-post/route.ts   # IA: Claude (Anthropic) o OpenAI GPT-4o
│   │   ├── publications/route.ts    # CRUD Supabase
│   │   ├── save-post/route.ts       # Guardado en archivos .md
│   │   ├── suggest-accounts/route.ts# Sugerencias ICP: Apollo + caché + rotación
│   │   └── tone-profile/route.ts    # Lectura/escritura de perfiles de tono
│   ├── globals.css                  # Tokens de tema (claro/oscuro), motion, Tailwind
│   ├── layout.tsx                   # HTML base, lang="es"
│   └── page.tsx                     # Componente principal (~2800 líneas)
├── supabase/
│   ├── tone_profiles.sql            # Tabla de perfiles de tono
│   └── account_suggestions.sql      # Tablas account_suggestions + suggestion_assignments
├── tone_profiles/
│   ├── README.md                    # Índice e instrucciones
│   ├── TEMPLATE.md                  # Plantilla para nuevos perfiles
│   └── *.md                         # Perfiles individuales del equipo
├── public/
│   └── images/gradient-background.jpg
├── CONTEXT.md                       # ⭐ Contexto completo: ICPs, flujos, cómo llega a todo
├── DESIGN.md                        # Sistema de diseño (300+ líneas)
├── PRODUCT.md                       # Brief de producto y requisitos
├── .env.local                       # Variables de entorno (no commitear)
└── package.json
```

---

## Instalación

### Requisitos
- Node.js 18+
- Cuenta en Supabase (tablas: `publications`, `tone_profiles`, `account_suggestions`, `suggestion_assignments`)
- Una API key de IA: **Anthropic** (recomendado) **u** OpenAI con saldo
- API key de **Apollo.io** (Settings → Integrations → API) para las sugerencias de ICPs

### Variables de entorno

Crea un archivo `.env.local` en la raíz con:

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...      # obligatoria

# IA del generador (basta UNA). Si está ANTHROPIC, se usa Claude; si no, OpenAI.
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-opus-4-8            # opcional (default: claude-sonnet-4-6)
OPENAI_API_KEY=sk-proj-...                   # respaldo / alternativa

# Sugerencias de ICPs
APOLLO_API_KEY=...                           # obligatoria para /api/suggest-accounts
```

> **Nota:** una versión previa resolvía el link de LinkedIn con Google Custom Search
> (`GOOGLE_API_KEY` + `GOOGLE_CX`). Se descartó porque la política de la organización de
> Google Cloud puede bloquear el JSON API. La versión actual usa **Apollo enrichment**.

### Supabase — tablas

```sql
-- 1) Publicaciones del calendario
create table publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  start_date date not null,
  end_date date not null,
  country text not null,
  category text,                 -- producto/tema → ICP a sugerir
  people text[] default '{}',
  created_at timestamptz default now()
);
```

Para `tone_profiles`, `account_suggestions` y `suggestion_assignments`, ejecuta los archivos
en `supabase/` (SQL Editor de Supabase). Resumen de las tablas de ICPs:

```sql
-- 2) Caché de personas resueltas (la "lista LinkedIn ICPs")
create table account_suggestions (
  apollo_id text primary key,
  category text, icp_group text, industry_tags text[], country text default '',
  first_name text, full_name text, title text, seniority text, headline text,
  company text, company_domain text, email_status text,
  linkedin_url text, resolved boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table account_suggestions enable row level security;

-- 3) Rotación: qué "bloque" (page) le tocó a cada publicación dentro de su país+tema
create table suggestion_assignments (
  pub_key text primary key,      -- "CO|Digital Identity|<publicationId>"
  scope   text not null,         -- "CO|Digital Identity"
  page    int  not null,
  created_at timestamptz default now()
);
create index idx_suggestion_assignments_scope on suggestion_assignments(scope);
alter table suggestion_assignments enable row level security;
```

### Comandos

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev
# http://localhost:3000

# Build de producción
npm run build

# Servidor de producción
npm start
```

---

## Deploy en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com)
2. Agrega las variables de entorno en **Settings → Environment Variables**:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (o `OPENAI_API_KEY`)
   - `APOLLO_API_KEY`
3. Deploy automático en cada push a `main`

---

## Sistema de sugerencias de ICPs (Apollo) — detalle técnico

Flujo completo de `POST /api/suggest-accounts` (todo en `app/api/suggest-accounts/route.ts`):

1. **Mapeo de filtros** (constantes en el archivo):
   - `PRODUCT_TO_TITLES`: producto/tema → lista de cargos (`GROWTH_TITLES` / `RISK_TITLES`; `Digital Identity` combina ambos).
   - `COUNTRY_TO_LOCATIONS`: país de la tarjeta → ubicaciones de Apollo.
   - `SENIORITIES = [head, manager, senior, vp, c_suite]`, `KEYWORD_TAGS = [fintech, payments, banking, financial services]`.
2. **Rotación (tabla `suggestion_assignments`)**: se calcula `scope = "<país>|<tema>"` y `pubKey = "<scope>|<publicationId>"`.
   - Si la publicación ya tiene asignación → se reusa su `page` (lista estable al reabrir).
   - Si no → `page = max(page del scope) + 1` y se guarda. Así cada publicación nueva toma un bloque distinto **sin repetir**.
   - Si Apollo devuelve vacío (pool agotado) → se borran las asignaciones del scope y se reinicia en `page = 1`.
3. **Búsqueda (gratis, sin créditos)**: `POST https://api.apollo.io/api/v1/mixed_people/api_search` con los filtros + `page` + `per_page`. Devuelve `id`, `first_name`, `title`, `organization` (apellido viene **ofuscado**).
4. **Caché (tabla `account_suggestions`)**: se consultan los `apollo_id` ya resueltos (`resolved = true`) → esos salen **gratis**.
5. **Enrichment (consume créditos, solo los nuevos)**: `POST .../api/v1/people/bulk_match` con los `id` no cacheados (lotes de 10). Devuelve **nombre completo + `linkedin_url`**. Se hace `upsert` en `account_suggestions` con `resolved = true`. **1 crédito por persona, una sola vez de por vida.**
6. **Respuesta**: lista en el orden de la búsqueda, con `name` (completo), `linkedinUrl` (directo) y `linkedinSearchUrl` (respaldo).

**Costos/créditos:** la *búsqueda* de Apollo no consume créditos; el *enrichment* sí (1 por persona nueva). La caché garantiza que nadie se enriquezca dos veces. Con rotación "por publicación", el costo crece con la cantidad de personas únicas mostradas, no con la cantidad de llamadas.

**Frontend (`app/page.tsx`):** el componente `SuggestedAccountsModal` consume el endpoint. Se monta en dos lugares: (a) al **crear una tarjeta** en el calendario (`suggestFor`, usa `publicationId = card.id`), y (b) al **generar un post** en "Crea tu post" (`showSuggest`, usa `selectedPubId`). El tema se infiere con `inferProduct(contenido)` o se toma de `publication.category`.

---

## Perfiles de tono del equipo

Los archivos en `/tone_profiles/` documentan el estilo de escritura de cada persona. Cada perfil incluye:
- Patrones de apertura y cierre
- Uso de emojis, hashtags y preguntas
- Vocabulario frecuente
- Posts de referencia
- Configuración sugerida para el generador

Para agregar un perfil nuevo, copia `TEMPLATE.md` y completa las secciones. El archivo también se puede generar automáticamente desde la app usando el modal "Adaptar tono".

---

## Diseño

El sistema de diseño completo está documentado en `DESIGN.md`. Resumen:

- **Tema claro/oscuro automático**: sigue la preferencia del sistema operativo vía `matchMedia("(prefers-color-scheme: dark)")` y reacciona en vivo si el usuario la cambia. Botón manual disponible como override.
- **Colores**: tokens CSS en `globals.css` (`--accent`, `--cal-*`, `--shadow-*`, etc.) — no uses hex directos. Acento `#6d28d9` (claro) / `#a78bfa` (oscuro).
- **Superficie**: sólida, hairlines y profundidad real con sombras en capas — sin glass/blur en contenido (solo en overlays fijos).
- **Tipografía**: Geist, pesos 400/600/700.
- **Países**: cada uno tiene color + bandera + etiqueta (nunca solo color).
- **Motion**: easing premium `cubic-bezier(0.32,0.72,0,1)` (`--ease-premium`), entradas con fade-up + blur, micro-interacciones de press/hover. Solo se animan `transform`/`opacity`/`filter` (GPU-safe).
- **Accesibilidad**: contraste AA, navegación por teclado, `aria-*` en interactivos, respeta `prefers-reduced-motion`.

---

## Contexto para Claude

Este proyecto usa **Next.js 16 (App Router)** — una versión con cambios que pueden diferir del comportamiento estándar conocido. Antes de modificar cualquier código, lee la guía relevante en `node_modules/next/dist/docs/`.

La lógica principal vive casi íntegramente en `app/page.tsx`. No hay librería de componentes externa; todo es custom. Los estilos usan Tailwind 4 con tokens CSS en `globals.css` — no uses colores hex directos, usa las variables del tema.
