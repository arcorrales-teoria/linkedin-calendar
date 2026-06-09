# Product

## Register

brand

## Users

Marketing teams and social media agencies managing LinkedIn content for multiple brand accounts or clients across LATAM countries (Colombia, Argentina, Peru, Chile, Mexico). They open this tool to plan, schedule, and track what goes live and when, across which market, without losing the thread of regional intent.

**Primary persona:** A senior social media manager at a LATAM agency. Manages 3–4 country accounts simultaneously. Opens the tool Monday morning to plan the week. Works on a MacBook Pro in a busy office. Fluent in Spanish. Accustomed to professional tools (Slack, Notion, Google Workspace). Will abandon a tool after one session if the workflow doesn't save time over Google Sheets.

**Current scope:** Single-user tool. Multi-user collaboration (shared calendars, approval workflows, @mentions) is out of scope for v1. The tool is designed for one person managing multiple country accounts, not a team dashboard. This distinction should drive modal UX, data model, and feature priority.

## Product Purpose

A LinkedIn publication calendar built specifically for LATAM content teams. It makes cross-country content planning visible at a glance: what's scheduled, for which country, and when. The AI tone adapter assists post generation in the author's own writing style — reducing the time from blank page to draft.

Success looks like: a content manager who never misses a market, never double-books a week, generates a credible first draft in under 60 seconds, and ships regional content with confidence. The tool must be faster than Google Sheets + LinkedIn native drafts for this to win.

## Brand Personality

Clean · Confident · LATAM. The tool is built for this region, not adapted from somewhere else. Warmth and identity come through the country flags, regional color cues, and purposeful details — not from loud UI. The interface stays out of the way; the content plan is the hero.

**Voice:** Spanish-first. All interface copy, labels, error messages, and notifications in Spanish. English is for external brand names (LinkedIn) and invisible technical identifiers only.

## Anti-references

- **Buffer, Hootsuite**: bloated, SaaS-generic, feels like enterprise software from 2018. Cluttered chrome, aggressive CTAs, low visual confidence.
- **HubSpot, Canva**: marketing-heavy UI, too much color, too many tooltips, too many gradients. Treats the user like they need hand-holding.
- **Monday.com, Asana**: corporate productivity aesthetic — flat, cheerful, completely devoid of editorial sensibility.
- **Generic Next.js starters**: Inter font, purple-violet accent, glassmorphism on every surface, floating background orbs. This is the default AI-generated aesthetic and must be actively avoided. Every design decision should be traceable to the LATAM content tool brief, not to a SaaS template.

## Design Principles

1. **Regional identity is structural, not decorative** — country flags and color cues are load-bearing UI, not emoji sprinkled on top. The calendar reads as designed for LATAM. Spanish is the interface language, not a localization layer.

2. **The plan is the product** — the calendar grid is the UI. Navigation, controls, and chrome exist only to serve it. Nothing competes with the month view. The AI generation panel assists planning; it does not replace the calendar as the primary surface.

3. **Every action confirms, every failure speaks** — no silent errors. If a save fails, the user sees it immediately with a recovery path. If generation succeeds, the confirmation is specific ("Borrador generado para Colombia"). Status is never ambiguous.

4. **Expert-first interaction** — this is a professional tool used daily by experienced content managers. Keyboard shortcuts, predictable behavior, and no forced hand-holding. Modals do not disable user overrides. The AI suggests; the user decides.

5. **Both modes feel native** — dark mode is not an afterthought. Light and dark each get their own visual logic, not just an inverted palette. The gradient background and glass system must work in both.

6. **Precision over decoration** — glassmorphism applies at structural levels (calendar window, modals) only. Buttons, inputs, chips, and list items are flat. Decorative elements (background orbs, gradient layers) serve the ambient quality of the gradient; they do not add blur or animation to interactive components.

## Accessibility & Inclusion

WCAG AA minimum throughout.

- **Contrast:** 4.5:1 for all body text and labels against their actual background (not an average — test against the lightest gradient region for glass-over-gradient surfaces). 3:1 for large text (≥18px or bold ≥14px) and UI component boundaries.
- **Keyboard:** All primary flows completable without a mouse. Focus indicators always visible (never suppressed). Modal focus trap with Esc dismiss. Disabled elements use `aria-disabled` and remain in tab order rather than being removed from it silently.
- **Screen readers:** All icon-only buttons have `aria-label` in Spanish. Decorative elements (background, orbs) are `aria-hidden`. Status changes (save, error, toast) use `role="status"` or `aria-live="polite"`. Modal uses `role="dialog"` with `aria-labelledby`.
- **Color independence:** Country identity always uses flag + label + color, never color alone. Selected states use a non-color indicator alongside fill.
- **Reduced motion:** All animations and transitions instant under `prefers-reduced-motion: reduce`.
- **Language:** `<html lang="es">`. Interface in Spanish reduces cognitive load for the primary user base.
