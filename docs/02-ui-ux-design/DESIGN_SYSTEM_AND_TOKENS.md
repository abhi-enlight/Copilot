# 🎨 Visual Design System & Design Tokens: The "Hardware-Grade" Cockpit

> **Design Directive**: "Anti-AI-Slop" Bespoke Agency Architecture ($150k+ Quality Standard)  
> **Visual Archetype**: **Obsidian Titanium & Ethereal Glass** (Inspired by Viktor.com & Teenage Engineering hardware)  
> **Core Rule**: Zero generic SaaS patterns. No flat gray borders. No cookie-cutter purple gradients. Every container looks like physical, machined hardware.  
> **Modern Web Standards**: Baseline CSS Container Queries (`@container`), Soft-Edge CSS Masks, `@starting-style` Top-Layer Animations, and strict WCAG AA A11y.

---

## 1. The Anti-Pattern Blacklist (Strictly Prohibited)

| Banned Element | Why It Looks Cheap | Mandatory Premium Replacement |
| :--- | :--- | :--- |
| **Banned Fonts** | `Inter`, `Roboto`, `Arial`, `Helvetica`, `Open Sans` | **Geist Grotesk** (display & UI), **Geist Mono** (data telemetry), and **Plus Jakarta Sans / Clash Display** for section titles. |
| **Banned Borders** | Generic `1px solid #e5e7eb` or `border-zinc-800` | **Double-Bezel (Doppelrand) Architecture**: An outer chassis (`rounded-[2rem] p-1.5 bg-white/[0.03] border border-white/[0.08]`) enclosing an inner core with concentric radius and an inset top rim-light. |
| **Banned Shadows** | Harsh black drops (`rgba(0,0,0,0.5)`, `shadow-lg`) | Multi-layered ambient diffusions + directional rim-lights (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_12px_32px_rgba(0,0,0,0.4)]`). |
| **Banned Icons** | Thick 2px stroke generic icons | Ultra-precise **1.25px hairline icons** (Phosphor Thin/Light, custom SVG monoline). |
| **Banned Motion** | Default `ease-in-out`, instant pops | Custom spring physics: `cubic-bezier(0.16, 1, 0.3, 1)` with 600ms–800ms fluid deceleration + `@starting-style` entry transitions. |
| **Banned Scrolling** | Hard-clipped scroll edges | **Soft-Edge CSS Gradient Masks** (`mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)`). |

---

## 2. Curated Color Palette & Material Tones

Our aesthetic uses a tailored OLED dark environment with tactile contrast:

```css
:root {
  /* Surface Chassis (Machined Aluminum / Deep Obsidian) */
  --bg-cosmos: #060709;
  --surface-chassis: #0B0D13;
  --surface-core: #10131B;
  --surface-raised: #151924;
  --surface-overlay: #1A1F2D;

  /* Precision Rim Lines & Hairlines */
  --border-hairline: rgba(255, 255, 255, 0.07);
  --border-glow: rgba(255, 255, 255, 0.14);
  --border-active: rgba(99, 179, 237, 0.35);

  /* Typography Hierarchy */
  --text-primary: #F0F4F8;        /* Cold White */
  --text-secondary: #94A3B8;      /* Slate Silver */
  --text-tertiary: #475569;       /* Muted Steel */
  --text-accent: #38BDF8;         /* Electric Cyan */

  /* Semantic Signal Lights (Telemetry & Radar) */
  --signal-teams: #5B5FC7;        /* Microsoft Teams Indigo */
  --signal-outlook: #0078D4;      /* Microsoft 365 Blue */
  --signal-slack: #E01E5A;        /* Slack Berry */
  --signal-urgent: #F43F5E;       /* Rose Red */
  --signal-success: #10B981;      /* Emerald Green */
  --signal-warning: #F59E0B;      /* Amber */

  /* Inset Rim Light for Double-Bezel */
  --inset-rim-light: inset 0 1px 1px rgba(255, 255, 255, 0.12);
}
```

---

## 3. The Double-Bezel (Doppelrand) Architecture

Every primary container, card, modal, and prompt dock must follow the **Double-Bezel concentric enclosure principle**:

```html
<!-- Outer Chassis (Machined Frame) -->
<div class="relative p-1.5 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
  
  <!-- Subtle Ambient Corner Flare -->
  <div class="absolute -top-12 left-1/4 w-32 h-16 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

  <!-- Inner Core (Tactile Screen Surface with Concentric Radius) -->
  <div class="relative rounded-[calc(2rem-0.375rem)] bg-[#0B0D13]/90 border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] p-6">
    <!-- Component Content -->
  </div>
</div>
```

---

## 4. Modern CSS Standards & Performance Optimizations

### 4.1 Container Queries for Responsive Fluidity
Components are encapsulated as autonomous containers using `container-type: inline-size`:
- **Action Cards**: Automatically switch between compact stacked layout (in sidebars) and side-by-side split layout (in center stream) using `@container (min-width: 480px)`.
- **Live Radar Pills**: Conditionally reveal context summaries and action buttons when container width exceeds `360px`.

### 4.2 Soft-Edge Content Fading (CSS Masks)
Scrollable areas (Intelligence Stream and Live Stack Radar) eliminate harsh container cutoffs using GPU-accelerated linear-gradient masks:
```css
.stream-fade-container {
  overflow-y: auto;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
}
```

### 4.3 Top-Layer Animations (`@starting-style` & `allow-discrete`)
Modals, drawers, and popovers animate into the browser top-layer without layout reflows or JavaScript coordinate hacks:
```css
dialog[open], [popover]:popover-open {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              display 0.35s allow-discrete,
              overlay 0.35s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: scale(0.95) translateY(12px);
  }
}
```

### 4.4 Accessibility & Kinetic Discipline (WCAG AA Compliance)
- **Visible Keyboard Focus**: All buttons, inputs, and interactive action chips feature `:focus-visible:ring-2 :focus-visible:ring-sky-400 :focus-visible:ring-offset-2 :focus-visible:ring-offset-[#060709]`.
- **Live Announcements**: Inbound live events from the Stack Radar are announced to screen readers via an invisible `<div aria-live="polite" aria-atomic="true" class="sr-only" />`.
- **Reduced Motion Protocol**: reduced motion is *fewer and gentler* animations, not none — a blanket `0.01ms` kill destroys the state feedback (hover, press, focus, loading) that users still need. Drop spatial movement; keep the transitions that carry state (colour, opacity, borders, shadows); and re-author looping indicators as a quiet opacity pulse so "busy" and "live" still read. The source of truth is the reduced-motion block at the end of `frontend/src/app/globals.css`; React-driven motion mirrors it via `<MotionConfig reducedMotion="user">` (`frontend/src/components/providers/MotionProvider.tsx`), which snaps transforms while opacity and colour keep animating.
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      /* non-spatial transitions only: transforms/translates/scales resolve instantly */
      transition-property: color, background-color, border-color, outline-color,
        text-decoration-color, fill, stroke, opacity, box-shadow !important;
      transition-duration: 150ms !important;
    }
    .animate-spin, .animate-ping, .animate-shimmer,
    .animate-radar-pulse, .animate-thinking-glow {
      animation: prism-reduced-pulse 2.4s ease-in-out infinite !important;
    }
  }
  ```

---

## 5. Haptic Island & Button-in-Button Architecture

Primary interactive triggers use the **Button-in-Button** pattern:
- The outer pill handles the main press physics with haptic feedback.
- The trailing indicator/arrow lives in its own nested circular island that animates independently on hover.

```html
<button class="group relative inline-flex items-center gap-3.5 pl-6 pr-2.5 py-2.5 rounded-full bg-white text-black font-medium text-xs tracking-wide transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-400">
  <span>Assign to Copilot</span>
  
  <!-- Nested Island Circle -->
  <div class="w-8 h-8 rounded-full bg-black/[0.08] flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
      <path d="M4 12L12 4M12 4H6M12 4V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</button>
```
