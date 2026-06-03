# Design System

## Theme

Dark-first. Near-black surface with very slight blue tint (`oklch(0.10 0.012 265)`). Warm amber accent (`oklch(0.78 0.17 65)`) as the single committed brand color. Country flags provide all additional hue variety; the base palette does not compete.

Light mode inverts the surface, keeps the amber accent slightly darker (`oklch(0.55 0.17 65)`), and uses a near-white with a hair of blue tint.

## Color Tokens

```css
/* Dark */
--bg-primary:    oklch(0.10 0.012 265)  /* near-black, slight blue */
--bg-secondary:  oklch(0.14 0.010 265)  /* cell backgrounds, weekends */
--bg-tertiary:   oklch(0.19 0.010 265)  /* hover, raised surfaces */
--border:        oklch(0.24 0.012 265)  /* grid lines */
--text-primary:  oklch(0.94 0.005 265)  /* main text */
--text-secondary:oklch(0.60 0.005 265)  /* labels, day names */
--text-muted:    oklch(0.40 0.005 265)  /* out-of-month dates */
--accent:        oklch(0.78 0.17 65)    /* amber — today, CTA */
--accent-dim:    oklch(0.78 0.17 65 / 0.14) /* today cell bg */

/* Light */
--bg-primary:    oklch(0.98 0.005 265)
--bg-secondary:  oklch(0.94 0.006 265)
--bg-tertiary:   oklch(0.89 0.008 265)
--border:        oklch(0.84 0.008 265)
--text-primary:  oklch(0.12 0.008 265)
--text-secondary:oklch(0.45 0.008 265)
--text-muted:    oklch(0.65 0.005 265)
--accent:        oklch(0.55 0.17 65)
--accent-dim:    oklch(0.55 0.17 65 / 0.12)
```

## Country Color Roles

Each country has a committed hue, used for event chips and week-gutter flags. These are the palette's only saturated colors in the neutral base.

| Country | OKLCH | Role |
|---------|-------|------|
| LATAM 🌎 | indigo `oklch(0.60 0.22 275)` | Default / multi-market |
| Colombia 🇨🇴 | amber `oklch(0.78 0.17 65)` | Shares accent anchor |
| Argentina 🇦🇷 | sky `oklch(0.65 0.18 220)` | |
| Peru 🇵🇪 | red `oklch(0.60 0.22 25)` | |
| Chile 🇨🇱 | emerald `oklch(0.65 0.18 155)` | |
| Mexico 🇲🇽 | lime `oklch(0.75 0.20 130)` | |

## Typography

### Fonts

| Role | Font | Usage |
|------|------|-------|
| Display | GeistPixelSquare | Month name (giant), section labels, modal headings |
| Body | GeistPixelGrid | Day numbers, event chips, body text, inputs |

No third family. These two carry everything.

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-giant` | clamp(2.8rem, 6vw, 5.5rem) | Month name in header |
| `--text-xl` | 1.125rem | — |
| `--text-base` | 0.875rem | Body, inputs |
| `--text-sm` | 0.75rem | Event chips, day numbers |
| `--text-xs` | 0.65rem | Day-of-week labels, footer |

Letter-spacing on display: `-0.02em`. Never tighter.

## Components

### Header
Asymmetric layout. Left: compact mark + nav controls. Right: action buttons. Month name lives BELOW the controls row — full-width, dramatically large, left-aligned. Separates navigation from identity.

### Calendar Grid
7-column grid with a narrow flag-gutter column (36px) on the left of each week row. Grid lines: 1px `var(--border)`. Weekend columns: `var(--bg-secondary)` background. Today cell: `var(--accent-dim)` background with amber day-number badge.

### Event Chip
`height: 20px`, `padding: 0 6px`, `border-radius: 4px`. Background: country color at 14% opacity. Text: country color full. Flag + truncated title. Max 3 chips per cell; overflow shows `+N` in muted text.

### Modal
`max-width: 440px`, `border-radius: 14px`, `padding: 24px`. Backdrop: `rgba(0,0,0,0.6)` with `backdrop-filter: blur(8px)`. Entrance: translateY(16px) → 0 + opacity, 220ms ease-out.

## Motion

- Modal: `slideUp` 220ms `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
- Dropdown: `fadeIn` 140ms ease-out
- Cell hover: background 100ms ease
- Month change: no full re-render animation (grid is data, not a route)
- `prefers-reduced-motion`: all transitions instant (0ms)

## Layout

- Calendar fills `100vh` vertically. No scrolling. Weeks share equal flex height.
- Header height: 54px (nav controls) + 64px (month title row) = two-zone header
- Day gutter: 36px
- Min cell height: driven by flex (typically 90-120px at 1080p)
