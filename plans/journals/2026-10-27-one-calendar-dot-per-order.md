---
title: One calendar dot per order
date: 2026-10-27
summary: Calendar markers now represent individual orders instead of unique statuses.
---

# One calendar dot per order

## What happened
The calendar grouped orders by delivery date and status, then emitted one marker for the whole group. Two NEW orders on the same day therefore produced one purple dot even though the accessible order count was correct.

## Decision
Keep the grouped query, but expand each group into one status entry per order. Render every entry without the previous three-dot cap, use unique React keys for repeated statuses, and keep the HTML mockup aligned.

## Verification
Added a regression case with two NEW orders and one CANCELLED order on the same date. The test failed before the fix and passed afterward. Typecheck, lint, all 34 tests, and the production build passed.

## Next steps
Visually confirm the calendar with authenticated sample data when browser access is available.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
