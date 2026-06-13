# CONTEXT — LinkedIn Calendar + Sugerencias de ICPs (Truora)

> Documento de contexto completo. Si acabas de hacer fork de este repo, **lee esto primero**:
> qué es la app, quiénes son los ICPs, la secuencia de pasos de cada flujo, cómo funciona por
> dentro y cómo la estrategia "llega a todo" el universo de cuentas objetivo.
> El detalle técnico de implementación está en [`README.md`](./README.md).

---

## 1. Resumen ejecutivo

Es una herramienta interna de **Truora** que une tres cosas en una sola pantalla:

1. **Calendario de publicaciones** de LinkedIn por país (LATAM).
2. **Generador de posts con IA** (Claude u OpenAI) que escribe en el tono de cada vocero.
3. **Sugerencias de cuentas (ICPs) para seguir**: al planear/generar un post, la app propone
   hasta **10 personas reales de LinkedIn** —con nombre completo y link directo— que vale la
   pena seguir/interactuar, segmentadas por el **tema** del post y el **país** de la publicación.

El objetivo de negocio: que cada pieza de contenido no solo se publique, sino que **active
relaciones con las personas correctas** (las que compran o influyen en la compra de Truora),
sin repetir a las mismas personas y cubriendo de forma sistemática todo el mercado.

---

## 2. Quiénes somos

- **Empresa:** Truora Inc.
- **Mercados:** Colombia, México, Perú, Chile, Argentina.
- **Qué vende Truora:** confianza digital — onboarding, identidad y verificación con menos fricción.
- **Productos (los que la app usa como "tema" del post):**
  | Producto (`category`) | Qué es |
  |---|---|
  | **WA Onboarding** | Onboarding de usuarios por WhatsApp |
  | **WA Banking** | Servicios financieros / banca por WhatsApp |
  | **WA Agentic** | Agentes conversacionales (IA) por WhatsApp |
  | **Digital Identity** | Identidad digital, verificación, KYC, antifraude |
  | **Background Checks** | Verificación de antecedentes |
- **Sectores de los clientes:** fintech, bancos, pagos, wallets, lenders, sofoms.

---

## 3. Quiénes son nuestros ICPs

El **ICP (Ideal Customer Profile)** depende del **producto/tema** del post. La app traduce cada
tema a un grupo de cargos objetivo, y los busca en empresas fintech/financieras del país elegido.

### Grupo A — Growth / Producto
**Temas que lo activan:** WA Onboarding, WA Banking, WA Agentic (y Digital Identity).
**Cargos objetivo:**
- Head of Product · Product Manager
- Head of Marketing · CMO
- Head of Growth
- Head of Operations
- Head of Digital Channels (canales digitales)
- Head of Digital Transformation

### Grupo B — Riesgo / Compliance
**Temas que lo activan:** Background Checks (y Digital Identity).
**Cargos objetivo:**
- Head of Risk · Chief Risk Officer (CRO)
- Head of Compliance · Compliance Officer · Chief Compliance Officer (CCO)
- Head of Legal · General Counsel
- Head of Onboarding
- Head of Digital Transformation

> **Digital Identity** es transversal: combina **Grupo A + Grupo B** (le interesa a producto/growth
> *y* a riesgo/compliance).

### Filtros transversales (siempre)
- **Seniority:** Head, Manager, Senior, VP, C-level.
- **Industria del empleador:** fintech, payments, banking, financial services.
- **País:** el de la tarjeta del calendario (`LATAM` = los 5 países; o `CO`/`MX`/`PE`/`CL`/`AR`).

### Ejemplos reales de cuentas que el sistema ha sugerido
Rappi, Nu, BBVA, Santander, Brubank, MACHBANK, RappiPay, Tpaga, Ligo, Puntored, Prex, Getnet,
Banamex, Tenpo, Openpay, Kravata, Culqi, ueno, Cobre, Plenti — CPOs, Heads of Growth/Compliance,
CROs, etc.

---

## 4. Cómo funciona la app (de punta a punta)

Tres pilares, una sola pantalla:

1. **Calendario** → planeas qué se publica, en qué país, qué día y con qué producto/tema.
2. **Generador** → describes el tema → la IA escribe el post en el tono del vocero.
3. **Sugerencias ICP** → al generar/crear, salen 10 personas para seguir, según tema + país.

La data persiste en **Supabase**. La IA es **Claude** (o OpenAI). Las personas vienen de **Apollo.io**.

---

## 5. Secuencia de pasos (flujos)

### Flujo A — Planear el mes
1. Abrir la app → vista de calendario mensual.
2. Filtrar por país si hace falta (LATAM / CO / AR / PE / CL / MX).
3. Ver de un vistazo qué está agendado y dónde.

### Flujo B — Crear una publicación (tarjeta)
1. Click en un día → modal **"Nueva publicación"**.
2. Completar **título**, **fechas** (rango), **país**, **producto** (= tema/ICP) y **personas** (voceros).
3. Guardar → la tarjeta queda en Supabase.
4. **Al guardar una tarjeta nueva, se abre automáticamente el popup de ICPs** para ese
   producto + país.

### Flujo C — Generar un post
1. Ir a **"Crea tu post"**.
2. (Opcional) vincular una publicación del calendario → autocompleta tema, país y enfoque.
3. Describir el tema, ajustar idioma/longitud/tono/foco, elegir autor.
4. **Generar post** → la IA devuelve el borrador (editable).
5. **Al generar, se abre el popup de ICPs** (tema inferido del contenido o tomado del producto
   de la tarjeta; país del calendario).
6. Copiar / **Publicar en LinkedIn** (abre el compositor con el texto cargado).

### Flujo D — Seguir a los ICPs sugeridos
1. En el popup salen hasta **10 personas**: nombre + apellido, cargo, empresa.
2. Botón **LinkedIn** → abre el **perfil directo** de la persona (o la búsqueda con su nombre si
   aún no se resolvió).
3. Seguir / interactuar.
4. Cambiar el **Tema** en el dropdown del popup → trae otro ICP al instante.

---

## 6. Cómo "llega a todo" (estrategia de cobertura)

El sistema está diseñado para **barrer sistemáticamente** todo el universo de ICPs, sin repetir
y sin que el equipo se pise entre sí:

- **Por país:** cada mercado tiene su propio pool y su propia rotación. `LATAM` cubre los cinco.
- **Por tema:** cada producto apunta a su grupo de cargos (A, B o ambos).
- **Rotación por publicación, sin repetir:** a cada publicación se le asigna un **bloque nuevo**
  de personas dentro de su país+tema. La siguiente publicación toma el bloque siguiente, **sin
  volver a mostrar a nadie** que ya salió — hasta agotar el pool; ahí el ciclo reinicia.
- **Lista estable y compartida:** reabrir la misma publicación muestra **la misma lista**, así
  todo el equipo que publique de (por ejemplo) Perú con el mismo tema ve a las mismas personas
  ese día. Coordinación sin duplicar esfuerzo.
- **Cadencia → ritmo de cobertura:** con ~2-3 publicaciones por semana por país/tema, cada
  semana se alcanzan personas nuevas. Multiplicado por países y temas, el universo se cubre
  de forma constante.
- **La caché es la lista maestra de ICPs:** cada persona resuelta queda en `account_suggestions`
  etiquetada por país + tema. Esa tabla **es** la "lista LinkedIn ICPs" y crece sola; sirve como
  registro de a quién ya se alcanzó y para medir cobertura.

**En una frase:** cada post empuja relaciones con un set fresco de las personas correctas; con el
tiempo, sin repetir, se recorre todo el mercado objetivo país por país y tema por tema.

---

## 7. Arquitectura técnica (resumen)

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Estilos | Tailwind 4 + tokens CSS, Geist, tema claro/oscuro según el sistema |
| Backend | Next.js API Routes |
| Base de datos | Supabase (PostgreSQL) |
| IA (generador) | Claude (Anthropic) → fallback OpenAI GPT-4o → fallback plantilla local |
| ICPs | Apollo.io: People Search (gratis) + Bulk Enrichment (1 crédito por persona, **cacheado**) |

**Flujo de `/api/suggest-accounts`:** mapear tema→cargos y país→ubicación → calcular el bloque
(rotación, tabla `suggestion_assignments`) → buscar en Apollo (gratis) → revisar caché
(`account_suggestions`) → enriquecer solo los nuevos (nombre completo + link) → guardar → responder.
Detalle paso a paso en el [README](./README.md#sistema-de-sugerencias-de-icps-apollo--detalle-técnico).

### Tablas de Supabase
- `publications` — tarjetas del calendario (incluye `category` = producto/tema).
- `tone_profiles` — estilo de escritura por vocero.
- `account_suggestions` — caché/lista maestra de ICPs resueltos (por país + tema).
- `suggestion_assignments` — qué bloque (page) le tocó a cada publicación (rotación sin repetir).

### Créditos y costos
- La **búsqueda** de Apollo **no** gasta créditos.
- El **enrichment** gasta **1 crédito por persona nueva**, una sola vez de por vida (queda cacheada).
- La IA del generador cobra por uso (Anthropic u OpenAI).

---

## 8. Setup rápido

```bash
npm install
npm run dev      # http://localhost:3000
```

`.env.local` necesario:
```bash
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...        # o OPENAI_API_KEY
APOLLO_API_KEY=...
```

Tablas: corre `supabase/account_suggestions.sql` y `supabase/tone_profiles.sql` en el SQL Editor
de Supabase, y crea `publications` (ver README). Variables en Vercel para deploy: las mismas tres.

---

## 9. Mantenimiento / dónde tocar

- **Cambiar ICPs (cargos):** `GROWTH_TITLES` / `RISK_TITLES` en `app/api/suggest-accounts/route.ts`.
- **Agregar/quitar productos:** `PRODUCT_TO_TITLES` (backend) y `PRODUCT_CATEGORIES` + `inferProduct` (`app/page.tsx`).
- **Cambiar industrias o seniority:** `KEYWORD_TAGS` / `SENIORITIES` en el route.
- **Cambiar el modelo de IA:** `ANTHROPIC_MODEL` en `.env.local` (default `claude-sonnet-4-6`).
- **Tono editorial del post:** `SYSTEM_PROMPT` en `app/api/generate-post/route.ts`.
