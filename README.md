# LinkedIn Calendar — LATAM Content Planner

Herramienta de planificación y generación de contenido para LinkedIn, diseñada para equipos de marketing LATAM que gestionan múltiples cuentas regionales. Combina un calendario visual mensual con generación de posts mediante IA (GPT-4o) y perfiles de tono personalizados por autor.

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

La generación usa GPT-4o con un system prompt en español de más de 250 líneas. Si la API falla, la app genera un post localmente usando plantillas por estilo y foco.

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
| Estilos | Tailwind CSS 4, CSS variables OKLCH, Geist font |
| Backend | Next.js API Routes (3 endpoints) |
| Base de datos | Supabase (PostgreSQL) |
| IA | OpenAI GPT-4o |
| Deploy | Vercel |

### API Routes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/generate-post` | POST | Genera un post llamando a OpenAI GPT-4o |
| `/api/publications` | GET / POST / DELETE | CRUD de publicaciones en Supabase |
| `/api/save-post` | POST | Agrega el post generado al archivo `.md` de perfil |

### Modelos de datos

```typescript
interface Publication {
  id: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  title: string;
  content: string;
  country: "LATAM" | "CO" | "AR" | "PE" | "CL" | "MX";
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
```

---

## Estructura de archivos

```
linkedin-calendar/
├── app/
│   ├── api/
│   │   ├── generate-post/route.ts   # Integración OpenAI
│   │   ├── publications/route.ts    # CRUD Supabase
│   │   └── save-post/route.ts       # Guardado en archivos .md
│   ├── globals.css                  # Tokens de tema, Tailwind
│   ├── layout.tsx                   # HTML base, lang="es"
│   └── page.tsx                     # Componente principal (~2500 líneas)
├── tone_profiles/
│   ├── README.md                    # Índice e instrucciones
│   ├── TEMPLATE.md                  # Plantilla para nuevos perfiles
│   └── *.md                         # Perfiles individuales del equipo
├── public/
│   └── images/gradient-background.jpg
├── DESIGN.md                        # Sistema de diseño (300+ líneas)
├── PRODUCT.md                       # Brief de producto y requisitos
├── .env.local                       # Variables de entorno (no commitear)
└── package.json
```

---

## Instalación

### Requisitos
- Node.js 18+
- Cuenta en Supabase con una tabla `publications`
- API key de OpenAI con acceso a GPT-4o

### Variables de entorno

Crea un archivo `.env.local` en la raíz con:

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENAI_API_KEY=sk-proj-...
```

### Supabase — tabla `publications`

Crea la tabla con esta estructura:

```sql
create table publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  start_date date not null,
  end_date date not null,
  country text not null,
  people text[] default '{}',
  created_at timestamptz default now()
);
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
   - `OPENAI_API_KEY`
3. Deploy automático en cada push a `main`

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

- **Colores**: Tokens OKLCH (no hex). Acento púrpura `#7c3aed` (claro) / `#a78bfa` (oscuro)
- **Tipografía**: Geist, pesos 400/600/700
- **Glass morphism**: `blur(80px) saturate(250%)` en modales, `blur(40px)` en paneles
- **Países**: Cada uno tiene color + bandera + etiqueta (nunca solo color)
- **Motion**: 220ms ease-out-expo para modales, 140ms para dropdowns
- **Accesibilidad**: WCAG AA, contraste 4.5:1, navegación completa por teclado, `aria-*` en todos los elementos interactivos, respeta `prefers-reduced-motion`

---

## Contexto para Claude

Este proyecto usa **Next.js 16 (App Router)** — una versión con cambios que pueden diferir del comportamiento estándar conocido. Antes de modificar cualquier código, lee la guía relevante en `node_modules/next/dist/docs/`.

La lógica principal vive casi íntegramente en `app/page.tsx`. No hay librería de componentes externa; todo es custom. Los estilos usan Tailwind 4 con tokens CSS en `globals.css` — no uses colores hex directos, usa las variables del tema.
