---
name: Sivlo Marketing Landing
description: A type specimen of the product name — private meeting intelligence set at awe scale on paper, measured by hairlines and mono coordinates.
colors:
  primary: "#1d5fd0"
  cobalt-deep: "#1749a6"
  paper: "#f5f2ec"
  paper-raised: "#fbfaf6"
  ink: "#1b1915"
  ink-soft: "#55514a"
  ink-faint: "#6e6659"
  rule: "#ddd7c9"
  rule-strong: "#1b1915"
typography:
  display:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(4.5rem, 15vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.035em"
    fontVariation: "wght 450..800 (scroll-driven)"
  headline:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.05em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
spacing:
  section-x: "clamp(1.5rem, 4vw, 3rem)"
  section-y: "clamp(4.5rem, 10vh, 7rem)"
  row-y: "2.5rem"
  stack-sm: "1.25rem"
  stack-lg: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "16px 24px"
    typography: 500, 15px, Schibsted Grotesk family
  button-primary-hover:
    backgroundColor: "{colors.cobalt-deep}"
    transform: "translateY(-1px)"
  topbar-action:
    textColor: "{colors.ink}"
    border: "1px solid {colors.ink}"
    padding: "8px 14px"
    hover: "border/color/background tint to cobalt"
  proof-data:
    backgroundColor: "transparent"
    borderRight: "1px solid {colors.rule}"
    borderTop: "1px solid {colors.rule-strong}"
---

# Design System: Sivlo Marketing Landing

## Overview

**Creative North Star: "The Measured Specimen"**

The landing page is a type specimen of the product name set on paper. The word **sivlo** is the subject of the page, rendered at awe scale in a variable editorial grotesque, measured the way a foundry measures type: hairlines, baseline rules, and mono coordinates. The world is quiet, warm, and precise — premium by restraint. Warm paper is the ground, deep ink is the only voice, and a single cobalt note is reserved for the live action and the boundary of the user's own device. Nothing floats, nothing glows; structure comes from ruled lines, not panels.

The page refuses the hero-card-and-screenshot SaaS template: no cards, no kickers, no stat tiles, no gradient text, no chrome. Proof is set as numbered figure plates and a ruled ledger, like figures in a well-made record book. Motion is a single quiet language — the brand word draws its baseline rule on load, sections fade in by opacity alone, and the word gains reading weight (variable 450–800) as it scrolls past, the one signature interaction. Under reduced motion every one of these falls static.

**Key Characteristics:**
- Paper as ground; ink as voice; hairlines as the only ornament.
- One cobalt note (primary action, "your device" boundary, live proof) per screen, never more.
- All data spoken in IBM Plex Mono coordinates at 11px uppercase.
- Awe-scale display type capped at 6rem; tight tracking; never gradient or outlined.
- Flat by default; depth is suggested by ruled plates, never shadows.

## Colors

A warm, near-white paper palette with a single cobalt accent. Secondary text is tinted ink at every step — never gray.

### Primary
- **Cobalt Note** (`#1d5fd0`, hover `#1749a6`): the primary download action, the "your device" boundary in the data-flow diagram, the live "0 uploads" certificate, the privacy mark, and the selection color. It is the only chroma on the page. On paper it holds ~5.3:1 contrast; white on it holds ~5.8:1.

### Neutral
- **Warm Paper** (`#f5f2ec`): page ground.
- **Raised Paper** (`#fbfaf6`): figure plates, privacy band, hover amends.
- **Ink** (`#1b1915`): primary text, baseline rules, the strong rule tops and bottoms of ledgers.
- **Quiet Ink** (`#55514a`): ledes and list text on paper (~7:1 contrast).
- **Faint Ink** (`#6e6659`): mono coordinates, captions, and meta lines (~5:1).
- **Hairline** (`#ddd7c9`): internal ruled lines and frames.
- **Scrollbar Wash** (`#b8b09e`): the themed scrollbar thumb.

### Named Rules
**The One Note Rule.** Cobalt appears on ≤15% of any given screen, and only where the product acts or proves itself: the download button, the "your device" boundary, the live certificate. Rarity is the point.

## Typography

**Display / Body Font:** Schibsted Grotesk (variable 400–900; fallback Helvetica Neue, Arial)
**Label / Mono Font:** IBM Plex Mono (400–500; fallback ui-monospace, Menlo)

**Character:** Schibsted Grotesk is an editorial grotesque with a tall, confident x-height — a newspaper face that reads premium and neutral, avoiding the AI-wave grotesque cluster. It carries both the brand word and the body. IBM Plex Mono is the lab voice: every measurement and datum is set in it.

### Hierarchy
- **Display** (700, `clamp(4.5rem, 15vw, 6rem)`, 0.9, −0.035em): the brand specimen word only. Weight varies live 450→800 as the word scrolls past; the coordinate line beneath names the face honestly.
- **Headline** (600, `clamp(2.25rem, 5.5vw, 3.75rem)`, 1.02, −0.02em): the tagline hero and section titles (section titles step down to `clamp(1.75rem, 3.5vw, 2.625rem)`). Sat on deliberately negative space, never an eyebrow above them.
- **Title** (600, `clamp(1.25rem, 2.4vw, 1.625rem)`, 1.15, −0.015em): ledger feature names.
- **Body** (400, 1.0625rem, 1.6): ledes and descriptions, set in Quiet Ink at ≤58ch.
- **Label** (IBM Plex Mono 400, 0.6875rem, 1.5, +0.05em, uppercase): coordinates, figure captions, proof data, footer links, release facts. Set in Faint Ink unless the datum is live, in which case Cobalt.

### Named Rules
**The Measured Label Rule.** Mono is never costume: every mono line names a real measurement or datum (48 kHz, on-device whisper, 0 uploads, weights and sizes). If it is not data, it does not wear mono.

**The No-Kicker Rule.** Nothing sits above a heading. A heading carries its own weight.

## Layout

One narrow gutter system: `max-width 1180px`, side padding `clamp(1.5rem, 4vw, 3rem)`, section padding `clamp(4.5rem, 10vh, 7rem)`. Space above a heading always exceeds the space below it.

- **Topbar:** sticky, three clear zones on the 1180px gutter — brand left; a centered mono nav ("Mechanism · Features · Privacy", hairline underline on hover); meta line + a bordered ink Download button right (hover lifts the border/color/5% cobalt tint to match the live action). Nav and meta hide below 720px; brand + Download remain.
- **Hero:** the specimen word, its ruled baseline with end tick, the headline, a ≤58ch-lede, a five-column proof ledger (stacking to 3, then 2 columns), and the single primary action (platform-detected) with an alternate-platform mono link beside it.
- **Proof ledger:** hairline grid — 1px strong top rule, hairline dividers between cells, hairline bottom.
- **Mechanism:** one section head, one full-width diagram sheet, then the figure plates (`fig. 00–03`): the diagram full-width; the home plate full-width; transcription and summary plates in a 2-column pair (single column at ≤720px). The diagram is an Excalidraw-authored schematic (fig. 00) laid out for strict left→right reading inside a dashed "YOUR DEVICE" frame: numbered mono stage tags (`01 capture · 02 mix · 03 transcribe · 04 record · 05 remember`) guide the eye — Mic + System audio → Mixer (48 kHz, ink-filled), a clean fork off the mixer's right edge into two parallel lanes (Recording/saved locally; VAD → on-device Whisper in cobalt), and both lanes drop vertically into a wide Working memory bar. Outside the frame, a dashed "the cloud" box is X-crossed and reached by a dashed red "blocked" arrow piercing the boundary (reads as a locked door); a cobalt "0 uploads" pill with two mono supporting lines anchors the corner. Cobalt appears only on Whisper, the seal, and the blocked outbound; red only on the blocked off-ramp; the sheet is `#f5f2ec` to sit on the section ground.
- **Feature ledger:** a ruled list under a strong cap rule — each row is two balanced tracks on desktop: a measured mono datum (`clamp(1–1.25rem)`, ink) in an 8.5–11rem rail, and a body of name, description (≤62ch), and a mono cross-reference link to the figure that evidences the row (`fig. 00–03` figure ids act as anchors; hover lifts the ref to cobalt). Rows separated by hairlines; generous desktop rhythm (`clamp(2.75–4rem)` padding).
- **Privacy band:** raised-paper band with hairline top/bottom; a two-column grid collapses to one.
- **Download close and footer:** centered-max-width CTA (platform-detected primary + alternate-platform mono link + live mono release facts), then a hairline-topped footer with a center-justified wordmark.

Breakpoints: 900px (proof and pairs reflow) and 720px (single column, topbar nav and meta hidden).

## Elevation & Depth

There is no shadow vocabulary. The system is flat; depth is conveyed by ruled plates (a hairline frame around a raised-paper sheet), by tonal layering (paper → raised paper), and by the single state lift on the primary button (`translateY(-1px)` on hover). A zero-offset shadow or a soft glow would break the world and is refused.

**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadow, no glow, no blur washes on content; hover moves the button one pixel and deepens the cobalt, nothing else.

## Shapes

Corner language is almost entirely rectilinear: hairlines, 1px frames, square plates, baseline ticks. The sole radius is the primary button (`6px`). Bullet marks in the privacy list are drawn 8px hairlines (1px × 0.5rem), never glyphs.

## Components

### Primary Button
Filled cobalt, white text, 16px/24px padding, 6px radius, sentence case — never uppercase. Hover deepens to `#1749a6` and lifts 1px; focus shows a 2px cobalt ring with 3px offset. A trailing `→` in mono is part of the mark. Label and target are resolved at runtime to the visitor's platform (macOS → DMG, Windows → NSIS `.exe`).

### Alternate Platform Link ("Also for …")
A quiet mono hairline link beside the primary action revealing the other platform's installer (macOS visitors see "Also for Windows", Windows visitors "Also for macOS"). Faint-ink mono, 1px rule underline; hover lifts to cobalt. Hidden until JS resolves the release; hidden entirely on unknown platforms. The primary button keeps the one cobalt note per screen.

### Topbar Action ("Download")
Text link in ink with a 1px underline; hover re-colors the underline and text cobalt. Sits in a sticky paper bar blurred at 88% opacity with a hairline bottom rule.

### Proof Ledger (data row)
A ruled five-cell row: mono datum key (Faint Ink) over a short value (500 weight, 13px). The live cell (NET · 0 uploads) is set wholly in Cobalt with tabular numerals.

### Figure Plates
Raised-paper sheet inside a 1px hairline frame; the figure number and caption set as mono coordinates beneath. Hover warms the frame toward ink.

### Feature Ledger (ruled rows)
A strong cap rule, then rows of `mono datum · name · description` separated by hairlines. Hover tints the datum cobalt; no row fill.

### Navigation & Footer
Top bar is a link-only nav (wordmark, mono meta, Download). Footer is wordmark, mono links with hairline underline on hover, and a faint mono legal line.

## Do's and Don'ts

### Do:
- **Do** build every structure from hairlines — strong rules only where a ledger begins or ends.
- **Do** set every measurement in IBM Plex Mono uppercase at 11px with +.05em tracking.
- **Do** keep the cobalt to one note per screen: the action or the proof.
- **Do** use the variable weight of Schibsted Grotesk for the brand word (live 450–800) and prevent weight from ever reading below 450 while visible.
- **Do** fade sections with opacity alone, settle, then ship.
- **Do** prefer commas and periods; the copy voice is measured, not hyphenated.

### Don't:
- **Don't** use cards, soft-shadow panels, or rounded containers — the ledger and the plate are the only two shapes.
- **Don't** place an eyebrow, kicker, or section number above a heading.
- **Don't** use gradient text, emoji, glyph icons, or a system display face; the word is set in Schibsted Grotesk only.
- **Don't** let the accent exceed one cobalt decision per screen.
- **Don't** ship stat-tile metrics; a single quiet "0 uploads" certificate carries the proof.