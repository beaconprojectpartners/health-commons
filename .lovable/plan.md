

## Problem

There's a conflict between two font declarations:

1. **CSS variable** (`--font-heading` in `index.css`): correctly set to `'Righteous', cursive`
2. **Tailwind config** (`tailwind.config.ts` line 17): still set to `'DM Serif Display', 'serif'`

Elements using the Tailwind `font-heading` class get DM Serif Display, which may not render correctly, causing a fallback to a system serif font. Meanwhile, elements using `var(--font-heading)` get Righteous. This inconsistency is the root cause.

## Fix

**One file change** in `tailwind.config.ts`:

- Line 17: Change `heading: ['DM Serif Display', 'serif']` to `heading: ['Righteous', 'cursive']`

This aligns the Tailwind utility with the CSS variable so all headings consistently use the Righteous font.

