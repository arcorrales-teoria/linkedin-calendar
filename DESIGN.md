# Design System

## Theme

Gradient-first, glass-selective. The background is a fixed photographic gradient (`/images/gradient-background.jpg`), creating ambient depth without per-element decoration. The calendar window floats on top as a heavy frosted panel. **Glassmorphism is structural only** — it applies at the window and modal level, not to individual buttons, inputs, or event chips. Interactive elements use flat surfaces so the calendar grid stays legible against the gradient.

Light mode: white-tinted frost over the gradient. Dark mode: deep purple-navy tinted glass, allowing gradient hues to bleed through at reduced intensity.

## Color Tokens

All tokens are OKLCH. Rgba tokens are for surfaces that require alpha compositing over the gradient background — do not use rgba for text/border tokens.

```css
/* ── Accent ── */
--accent:        oklch(0.47 0.25 293)   /* purple — CTA, today, selected */
--accent-light:  oklch(0.67 0.18 295)   /* dark mode accent */
--accent-dim:    oklch(0.47 0.25 293 / 0.14)  /* today cell bg, selection bg */

/* ── Text — LIGHT ── */
--text-primary:   oklch(0.13 0.018 280)         /* body text */
--text-secondary: oklch(0.40 0.012 280)         /* labels, day names */
--text-muted:     oklch(0.58 0.008 280)         /* out-of-month, placeholder */

/* ── Text — DARK ── */
--text-primary:   oklch(0.93 0.010 290)
--text-secondary: oklch(0.68 0.015 285)
--text-muted:     oklch(0.52 0.012 285)

/* ── Borders ── */
--border-light: rgba(20, 18, 40, 0.09)
--border-dark:  rgba(255, 255, 255, 0.10)

/* ── Calendar surface — LIGHT (over gradient) ── */
--cal-window-bg:    rgba(255, 255, 255, 0.45)   /* outer window only */
--cal-cell-bg:      rgba(255, 255, 255, 0.22)   /* grid cells */
--cal-cell-weekend: rgba(255, 255, 255, 0.10)
--cal-cell-today:   oklch(0.47 0.25 293 / 0.13)
--cal-cell-hover:   rgba(255, 255, 255, 0.50)
--cal-header-bg:    rgba(255, 255, 255, 0.30)

/* ── Calendar surface — DARK (over gradient + tint) ── */
--cal-window-bg:    rgba(18, 12, 48, 0.62)
--cal-cell-bg:      rgba(30, 20, 65, 0.35)
--cal-cell-weekend: rgba(10, 6, 30, 0.45)
--cal-cell-today:   oklch(0.67 0.18 295 / 0.18)
--cal-cell-hover:   rgba(255, 255, 255, 0.10)
--cal-header-bg:    rgba(18, 12, 48, 0.42)

/* ── Status ── */
--status-success: oklch(0.62 0.18 145)
--status-error:   oklch(0.58 0.22 25)
--status-warning: oklch(0.72 0.18 65)
```

**Contrast requirements:** Body text must hit 4.5:1 against its container background. `--text-secondary` on glass surfaces must be verified — the target at dark mode is oklch(0.68 0.015 285) on rgba(18,12,48,0.62), which clears 4.5:1 when the underlying gradient is dark. Test against the lightest gradient region. `--text-muted` (oklch 0.52) is for non-essential decorative text only, never for labels or status.

## Country Color Roles

Country hues are the palette's only additional saturated colors. Used exclusively for event chips and the week-gutter marker. All rendered with flag + label — color is never the sole country indicator.

| Country | OKLCH | Chip bg (14% opacity) |
|---------|-------|-----------------------|
| LATAM 🌎 | indigo `oklch(0.55 0.22 278)` | `oklch(0.55 0.22 278 / 0.14)` |
| Colombia 🇨🇴 | amber `oklch(0.70 0.17 65)` | `oklch(0.70 0.17 65 / 0.14)` |
| Argentina 🇦🇷 | sky `oklch(0.62 0.18 220)` | `oklch(0.62 0.18 220 / 0.14)` |
| Peru 🇵🇪 | red `oklch(0.57 0.22 25)` | `oklch(0.57 0.22 25 / 0.14)` |
| Chile 🇨🇱 | emerald `oklch(0.62 0.18 155)` | `oklch(0.62 0.18 155 / 0.14)` |
| Mexico 🇲🇽 | lime `oklch(0.72 0.20 130)` | `oklch(0.72 0.20 130 / 0.14)` |

## Typography

### Fonts

| Role | Font | Import |
|------|------|--------|
| Display | `Geist` weight 600–700 | `geist` npm package |
| Body | `Geist` weight 400–500 | `geist` npm package |

Single family. No second family. Geist at weight contrast (400 body, 600 labels, 700 display) carries all hierarchy without pairing noise. The `geist` package is already in `package.json`.

**Do not use Inter.** Inter is in the reflex-reject list; it reads as a Next.js starter default, not a designed choice.

### Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-giant` | clamp(2.4rem, 5vw, 4.5rem) | 700 | Month name in header |
| `--text-xl` | 1.125rem | 600 | Modal headings, section titles |
| `--text-base` | 0.9375rem | 400 | Body, inputs, modal content |
| `--text-sm` | 0.8125rem | 400–500 | Event chips, day numbers |
| `--text-xs` | 0.6875rem | 500 | Day-of-week column headers only |

Letter-spacing on display (`--text-giant`): `-0.02em`. Never tighter.
Line-height: `1.5` for body, `1.2` for display. Dark-on-light bumps line-height to `1.6`.

### Label rules

- Labels use `--text-sm` at weight 500, `letter-spacing: 0.01em`.
- **No uppercase on form labels.** Uppercase is reserved for day-of-week column headers (`SUN MON TUE`) and country chip abbreviations.
- Sentence case everywhere else.

## Glassmorphism Usage Rules

Glass blur is **structural, not decorative**. Apply at two levels only:

| Level | Token | `backdrop-filter` | Where |
|-------|-------|-------------------|-------|
| Window | `--cal-window-bg` | `blur(80px) saturate(250%)` | Outer calendar container, modals |
| Panel | `--cal-header-bg` | `blur(40px) saturate(200%)` | Toolbar, header bar |

**Never apply `backdrop-filter` to:** buttons, inputs, dropdowns, event chips, list items, tooltips, or any element that repeats more than twice on screen. Blur on repeated elements destroys readability and triggers GPU overdraw.

Flat interactive elements (buttons, inputs) use solid background tokens — either `--cal-cell-bg` or a fully opaque fill — not glass.

## Components

### Background System

Two layers:
1. `body { background-image: url('/images/gradient-background.jpg'); background-size: cover; background-attachment: fixed; }`
2. Dark mode overlay: `body::before` with `rgba(8, 4, 28, 0.34)` at `z-index: 0`

The calendar window sits at `z-index: 10` above the background system.

### Header

Two-zone layout. Zone 1 (54px): nav controls left, action buttons right, `--cal-header-bg` glass. Zone 2 (64px): full-width month name, `--text-giant`, left-aligned, plain background (no glass). Separating these zones creates typographic scale contrast that reads across the gradient.

### Calendar Grid

7-column grid + 1 narrow flag-gutter column (32px) at row start. Grid lines: 1px `var(--border)`. Weekend columns: `--cal-cell-weekend`. Today: `--cal-cell-today` with accent day-number badge (no glow shadow). All cells are flat — no `backdrop-filter`.

### Event Chip

```
height: 22px
padding: 0 7px
border-radius: 4px
font-size: var(--text-sm)
background: <country-color at 14% opacity>
color: <country-color full>
```

Flag emoji + title (truncated). Max 3 chips per cell; overflow shows `+N` in `--text-muted`. No border, no box-shadow, no blur.

### Buttons

**Primary (CTA):** `background: var(--accent)`, white text, `border-radius: 8px`, `padding: 8px 16px`. Flat. No glass. Box-shadow limited to subtle depth: `0 1px 3px rgba(0,0,0,0.12)`.

**Secondary:** `background: transparent`, `border: 1px solid var(--border)`, `color: var(--text-primary)`. Flat. Hover: `background: var(--cal-cell-hover)`.

**Disabled state:** `opacity: 0.38` (not 0.45 — 0.38 is the WCAG-aligned disabled floor). Always keep in tab order with `aria-disabled` instead of `disabled` where possible; removing from tab order silently breaks keyboard navigation.

### Inputs / Selects

Flat surface: `background: var(--cal-cell-bg)`, `border: 1px solid var(--border)`, `border-radius: 6px`. No blur. Focus ring: `outline: 2px solid var(--accent)`, `outline-offset: 2px`.

### Modal

```
max-width: 480px
border-radius: 14px
padding: 24px 28px
backdrop-filter: blur(80px) saturate(250%)    ← window-level glass, appropriate here
background: var(--cal-window-bg)
box-shadow: 0 40px 100px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.12)
```

**Modal UX spec:**
- Maximum 4 fields visible at once without a visual group break.
- Primary action (Save/Create) is always the rightmost bottom button.
- Destructive action (Delete) is separated to the left, never adjacent to Save.
- Esc key closes. Focus is trapped inside while open. On close, focus returns to the trigger element.

### Dropdown

`position: fixed` — not `absolute` inside an overflow container. `border-radius: 10px`. Entrance: `fadeIn 140ms ease-out`. No blur.

### Toast / Status Notification

Fixed-position, bottom-right, `z-index: var(--z-toast)`.

```
padding: 12px 16px
border-radius: 8px
font-size: var(--text-sm)
max-width: 340px
```

States: success (`--status-success`), error (`--status-error`), neutral. Auto-dismiss: 4 seconds for success/neutral, persistent for errors (requires explicit dismiss). Error toasts include a "Retry" action when the failure is retriable.

## Error & Status States

Every async operation must surface a visible outcome. No `.catch(() => {})`.

| Operation | Success | Error |
|-----------|---------|-------|
| Save publication | Toast: "Publicación guardada" | Toast: "No se pudo guardar. Reintentar" |
| Delete publication | Toast: "Publicación eliminada" | Toast: "No se pudo eliminar" |
| Save tone profile | Toast: "Perfil guardado" | Toast: "Error al guardar perfil" |
| Generate post | Inline: content appears | Inline: "No se pudo generar. Intenta de nuevo" |

Error messages are always in Spanish (see Language rules). Never expose technical error strings to users.

## Empty & Loading States

| State | Treatment |
|-------|-----------|
| Calendar with no events | Muted day cells with a single inline hint in the first visible week: "Haz clic en cualquier día para añadir una publicación" |
| No tone profiles | Tone selector shows: "Sin perfil — agrega uno para personalizar el tono" as placeholder |
| Generating post | Skeleton text at `--text-muted` opacity, 3 lines, no shimmer animation |
| Loading calendar data | Calendar cells render empty first; events populate without a full-page loader |

## Keyboard Interactions

All primary flows must be completable without a mouse.

| Key | Action |
|-----|--------|
| `N` | Open create-post modal on today's date (when no modal is open) |
| `←` / `→` | Navigate to previous / next month |
| `Esc` | Close any open modal or dropdown |
| `Enter` on a calendar cell | Open create-post modal for that date |
| `Tab` | Traverse interactive elements in reading order |
| `Shift+Tab` | Reverse tab order |
| Arrow keys in DateRangePicker | Move selection forward/backward one day |

Focus indicator: `outline: 2px solid var(--accent)`, `outline-offset: 2px`. Never suppress focus indicators.

## Z-Index Scale

```css
--z-bg:       0    /* background layers */
--z-base:     10   /* calendar window */
--z-sticky:   20   /* sticky toolbar / header */
--z-dropdown: 100  /* dropdowns, popovers */
--z-modal-bg: 200  /* modal backdrop */
--z-modal:    210  /* modal content */
--z-toast:    300  /* toast notifications */
--z-tooltip:  400  /* tooltips */
```

Never use arbitrary values like 999 or 9999. If a new layer is needed, extend this scale.

## Motion

- Modal entrance: `translateY(16px) → 0` + `opacity 0 → 1`, `220ms cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
- Dropdown: `opacity 0 → 1` + `translateY(-4px) → 0`, `140ms ease-out`
- Cell hover: `background` transition `100ms ease`
- Toast entrance: `translateX(110%) → 0`, `200ms cubic-bezier(0.16, 1, 0.3, 1)`
- Month navigation: instant (no re-render animation — grid is data, not a page)

**Floating orbs (if retained):** Must be `aria-hidden="true"`. Reduce animation intensity — `opacity: 0.25 max`. Consider removing entirely; the gradient background provides sufficient ambient character without the GPU cost.

`prefers-reduced-motion`: all transitions and animations instant (0ms). Implement via:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }
}
```

## Accessibility

WCAG AA minimum throughout.

**Contrast checklist (verify per deploy):**
- `--text-primary` on `--cal-cell-bg` (glass surface): must clear 4.5:1 against the underlying gradient
- `--text-secondary` on glass: 4.5:1 minimum — verify against lightest gradient region, not just average
- Accent color on white / `--cal-cell-bg`: 3:1 minimum for large text (month name), 4.5:1 for labels at `--text-sm`
- Disabled elements at `opacity: 0.38`: acceptable, but do not rely on color alone to communicate disabled state — add `aria-disabled`

**ARIA requirements:**
- All icon-only buttons: `aria-label="[action in Spanish]"`
- Decorative elements (orbs, background): `aria-hidden="true"`
- Form inputs: paired `<label htmlFor>`, not just `aria-label`
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal heading
- Status changes (toast, save confirmation): `role="status"` or `aria-live="polite"`
- Destructive actions: `aria-label` must name the item being deleted ("Eliminar publicación Colombia 5 jun")

**Color as sole indicator:** Never. Every country chip shows flag + label alongside color. Selected/active states use an additional indicator (ring, checkmark, or weight change) beyond color fill.

## Language & Localization

The UI is Spanish-first. English appears only in:
- Technical identifiers not shown to users (keys, IDs)
- External brand names (LinkedIn)

**Rules:**
- All labels, placeholders, button text, error messages, and toast notifications: Spanish
- Month names in calendar header: Spanish (`Enero`, `Febrero`, …)
- Day-of-week column headers: Spanish abbreviated (`LUN`, `MAR`, `MIÉ`, `JUE`, `VIE`, `SÁB`, `DOM`)
- Date formatting: `8 de jun.` format throughout — never "Jun 8" or mixed locale
- `<html lang="es">` — update layout.tsx

## Layout

- Calendar fills `100vh`. No page scroll. Weeks share equal flex height.
- Header: two-zone (54px nav controls + 64px month title) = 118px total
- Flag gutter: 32px
- Min cell height: flex-driven (typically 90–120px at 1080p, scales down gracefully to ~60px)
- Mobile: below 768px, collapse to a vertical list view — the 7-column grid does not scale to phone viewports. The list view groups events by day.
- Max content width: `1440px`. Centers on ultrawide with `margin: 0 auto`.
