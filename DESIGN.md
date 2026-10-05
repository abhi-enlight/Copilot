---
name: Prism
description: The Morning Briefing Desk — a warm, machined operations cockpit for executive work.
colors:
  accent: "#0284c7"
  accent-deep: "#1d4ed8"
  accent-bright: "#38bdf8"
  accent-subtle: "#e0f2fe"
  ink: "#0f172a"
  surface-base: "#FAFAF9"
  surface-elevated: "#FFFFFF"
  surface-recessed: "#F5F5F4"
  surface-hover: "#F0EFED"
  surface-active: "#E7E5E4"
  surface-inverse: "#1C1917"
  text-primary: "#1C1917"
  text-secondary: "#78716C"
  text-tertiary: "#A8A29E"
  text-inverse: "#FAFAF9"
  border-subtle: "rgba(0, 0, 0, 0.06)"
  border-default: "rgba(0, 0, 0, 0.09)"
  border-focus: "rgba(0, 0, 0, 0.18)"
  signal-success: "#22C55E"
  signal-warning: "#F59E0B"
  signal-danger: "#EF4444"
  signal-info: "#3B82F6"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "20px"
  "3xl": "24px"
  "4xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#292524"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-ghost:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  chip:
    backgroundColor: "{colors.surface-recessed}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  nav-item-active:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Prism

## Overview

**Creative North Star: "The Morning Briefing Desk"**

Prism is a desk, not a dashboard. The surface is warm and quiet at rest, everything is placed where a hand expects to find it, and the only thing that changes on its own is the briefing arriving. The interface assumes an executive is reading it in the first ten minutes of their day, half-attention, coffee in hand — so hierarchy is carried by weight and space, never by color shouting.

The material language is machined: hairline seams, concentric radii, a recessed chassis that holds an elevated input dock. Depth is honest (a real surface sitting in a real tray), never decorative glow. Motion is spring-eased and short; a control that is pressed moves, a control that is idle does not.

**Key Characteristics:**
- Warm stone neutrals as the floor; one sky accent used sparingly.
- Machined, concentric geometry: outer radius = inner radius + the padding between them.
- Depth by layering and 1px seams, not by heavy or colored shadows.
- Restrained motion with tactile press states (spring easing, `scale(0.97)` on press).
- Executive legibility: nothing important below 12.5px, nothing informational hidden behind hover only.

## Colors

The palette is warm neutral stone with a single cool accent, plus four semantic signals that exist only to communicate state.

### Primary
- **Prism Sky** (#0284c7): the one accent. Primary CTAs, active focus rings, live/active indicators, the brand mark gradient's mid-stop. Confirmed as the single accent; the legacy indigo (#6366F1) in `--accent` is being retired and must not be used in new work.
- **Prism Sky Deep** (#1d4ed8): pressed/hover state of accent actions and the brand gradient's deep stop.
- **Prism Sky Bright** (#38bdf8): the brand gradient's light stop and radar/telemetry live indicators only.
- **Sky Mist** (#e0f2fe): accent-tinted informational backgrounds (replaces the retired indigo-50 wash).

### Neutral
- **Warm Paper** (#FAFAF9): application floor. The page background, never pure white.
- **Sheet** (#FFFFFF): elevated surfaces — cards, the inner input dock, panels over the floor.
- **Sunk** (#F5F5F4): recessed trays and the outer input-dock chassis.
- **Hover Wash** (#F0EFED) and **Pressed Wash** (#E7E5E4): interactive neutral states.
- **Warm Ink** (#1C1917): primary text and inverse surfaces. Dark surfaces are warm black, never `#000000`.
- **Warm Slate** (#78716C) secondary text, **Quiet Stone** (#A8A29E) tertiary/labels, **Paper Text** (#FAFAF9) text on ink.

### Named Rules
**The One Accent Rule.** Prism Sky appears on ≤10% of any given screen. Its scarcity is what makes an approval or a primary action readable at a glance.

**The Warm Floor Rule.** No pure white page backgrounds and no pure black text or surfaces. The floor is #FAFAF9 and ink is #1C1917; pure values flatten the machined depth.

## Typography

**Display Font:** Geist (with system sans fallback)
**Body Font:** Geist (same family)
**Label/Mono Font:** Geist Mono

**Character:** One family, two voices. Geist carries everything a person reads; Geist Mono is reserved for machine facts — identifiers, timestamps, counts, amounts. The pairing keeps the interface calm while still signalling "this number came from a system."

### Hierarchy
- **Display** (700, 26px, line-height 1.15, -0.025em): the briefing greeting and empty-state moments. One per screen.
- **Headline** (700, 20px, line-height 1.2): panel and section titles.
- **Title** (600, 15px, line-height 1.3): card titles, proposal titles, list-row primaries.
- **Body** (400, 14px, line-height 1.6): message text, descriptions. Cap prose at 65–75ch.
- **Label** (600, 12px, 0.05em, uppercase): field labels, chip labels, column headers.
- **Mono** (500, 11px, 0.02em): timestamps, record IDs, risk levels, counts.

### Named Rules
**The Legibility Floor Rule.** Operational text never drops below 12.5px, and tertiary text (#A8A29E) is never used for content the user must read — it is 10–11px in the incumbent cockpit and fails WCAG AA on the warm floor. Raise the body range to 12.5–14px during the type-scale pass.

**The Numbers Are Machine Facts Rule.** Any value a user might repeat in a meeting (amount, count, deadline, ID) renders in Geist Mono; prose never does.

## Layout

The cockpit is a fixed three-panel desk: navigation rail (256px expanded / 64px collapsed), the briefing stream, and the live radar (340px, only at ≥1280px). The stream is the focus column and centres its content at `max-w-3xl`; panels are separated by 1px seams rather than gaps, so the desk reads as one milled part.

Rhythm is 4-based (4 / 6 / 8 / 12 / 16 / 20 / 24 / 32) with 16–24px panel padding and 12–20px card padding. Marketing and full-bleed surfaces use section rhythm of 64–96px, `max-w-7xl` containers, and `min-h-[100dvh]` for first-viewport blocks — never `h-screen`.

Below 768px the three-panel grid collapses to a single column with the rail and radar as drawers; no panel is squeezed, it is hidden behind an explicit control.

## Elevation & Depth

Depth is a hybrid: tonal layering does most of the work (sunk → sheet → raised sheet), and shadows are ambient rather than structural. Shadows are tinted warm-black at very low alpha, never pure black, and never colored except for the accent button's own subtle lift.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)`): idle cards and rows.
- **Hover / Dock** (`0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)`): interactive lift and the input dock at rest.
- **Focus / Overlay** (`0 4px 12px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.06)`): focused dock, popovers, drawers.
- **Modal** (`0 8px 24px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.06)`): dialogs and elevated overlays.

### Named Rules
**The Two-Layer Dock Rule.** The input dock is always a recessed tray holding an elevated sheet: the outer chassis is sunk (#F5F5F4, 6px padding, `radius-2xl`) and the inner field is sheet white (`radius-xl`). The 6px tray is what makes the dock feel physically seated — do not collapse it into a single bordered input.

**The Seam Over Shadow Rule.** Separation between panels, rows and sections is a 1px `rgba(0,0,0,0.06)` hairline, not a shadow. Shadows are reserved for things that float above the desk.

## Shapes

Form is concentric and consistent: outer radius = inner radius + the padding between them (a 24px tray holding a 20px field at 6px padding, a 16px card holding a 12px inner block at 4px). The radius scale is 6 / 8 / 12 / 16 / 20 / 24px, with full pills reserved for chips and status pills only.

Borders are hairline and warm: subtle `rgba(0,0,0,0.06)` at rest, default `rgba(0,0,0,0.09)`, focus `rgba(0,0,0,0.18)`. Circles are reserved for the logo tile (30% radius rounded square), avatars and status dots.

**The Concentric Radius Rule.** Never nest two equal radii. Every inset block steps down by the padding it sits in, so curves stay parallel to the seam.

## Components

### Buttons
- **Shape:** rounded rectangles (16px), full-width inside panels, single-line labels only.
- **Primary:** Warm Ink background, Paper Text label, 10px vertical / 16px horizontal padding, 600 weight. Used for the single most important action in a view.
- **Accent:** Prism Sky background (#0284c7), Paper Text, 12px / 16px. One per surface (e.g. the auth form's submit).
- **Hover / Focus:** background deepens (primary → #292524, accent → #1d4ed8); press applies `scale(0.98)`. Focus is a 2px sky ring at 20% alpha plus a border shift, never a glow.
- **Ghost / Secondary:** Sheet background with a hairline border, Warm Ink label. Used for "Email me a sign-in link"-class alternatives.

### Chips
- **Style:** Sunk background (#F5F5F4), Warm Slate label, full pill, 6px / 12px padding, 12px label type.
- **State:** selected chips move to a sky-mist background with sky text; risk chips use the semantic signals (success/warning/danger) at tinted background with full-strength text. Chips are filters and labels, never primary actions.

### Cards / Containers
- **Corner Style:** 16px, concentric with any inset block.
- **Background:** Sheet white on the warm floor; never stacked shadows.
- **Shadow Strategy:** Rest shadow only when the card is interactive; otherwise a hairline border is enough.
- **Internal Padding:** 16–20px, 12px between rows.

### Inputs / Fields
- **Style:** Sheet background, hairline border, 12px radius, 44px minimum height, 14px text, label above (never placeholder-as-label).
- **Focus:** border shifts to the focus tone plus a 2px sky ring at 20% alpha; the dock's tray deepens its shadow at the same time.
- **Error / Disabled:** inline error block below the field in danger tint; disabled fields drop to 50% opacity and keep their readable label.

### Navigation
- **Style:** a left rail of 12px-radius rows with a 3px sky left edge on the active row; icon plus label, 16px Phosphor icons at a global 1.5–2.0 stroke.
- **States:** default Warm Slate, hover on the wash, active Warm Ink with the sky edge.
- **Mobile:** the rail collapses behind an explicit control (and to a 64px icon-only rail at desktop widths when collapsed), never into a hamburger on desktop.

### Action Card (signature)
The approval card is the product's signature component and must read as a physical document on the desk: proposal title in Title type, description in Body, risk level in Mono, an explicit Approve / Reject pair, and an edit affordance that only exposes allowlisted fields. Approved and executed states restyle the card (border tone + result summary in Mono) rather than replacing it, so the record stays in the stream.

### Input Dock (signature)
The recessed-tray dock described in the Two-Layer Dock Rule, hosting the composer, the model/tool chips, and the send or stop control. At rest it shows the hover shadow; on focus it lifts to the focus shadow and the tray border darkens.

## Do's and Don'ts

### Do:
- **Do** use Prism Sky as the only accent, and cap it at roughly 10% of a screen.
- **Do** keep the warm floor (#FAFAF9) and warm ink (#1C1917) — no pure white or pure black.
- **Do** express depth with the four named shadows plus tonal layering, and express separation with 1px hairlines.
- **Do** keep outer and inner radii concentric, stepping by the intervening padding.
- **Do** put every machine fact (amount, count, ID, timestamp, risk level) in Geist Mono.
- **Do** use `min-h-[100dvh]` for first-viewport blocks and reserve `h-screen` for the fixed app shell.
- **Do** give every interactive element a hover, focus-visible and pressed state, and honour `prefers-reduced-motion`.

### Don't:
- **Don't** introduce indigo (#6366F1) or any violet gradient in new work; that accent is retired in favour of Prism Sky.
- **Don't** add a second or third accent hue for decoration — the cockpit currently carries nine hue families (indigo, violet, blue, teal, rose, amber, emerald, red, sky) and new work must stay in stone + sky + the four semantic signals.
- **Don't** render body or label text below 12.5px, and don't use #A8A29E for content that must be read.
- **Don't** put heavy or colored shadows under resting surfaces, and don't stack shadows for emphasis.
- **Don't** use pure-white cards on pure-white floors — surfaces separate by tone and seam.
- **Don't** ship a screen that only works in one appearance: dark mode is not implemented in the incumbent system, so any new dark styling must be deliberate and complete rather than a few stray `dark:` utilities.
