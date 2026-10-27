---
title: Shop best sellers and cancellation rate
date: 2026-10-27
summary: Added completed-order product rankings and the shop cancellation-rate KPI.
---

# Shop best sellers and cancellation rate

## What happened
The shop information page now shows a cancellation-rate KPI and a Top 5 best-selling product list with quantity and revenue ranking modes.

## Decision
Cancellation rate is CANCELLED orders divided by every stored order, with 0% for an empty database. Product rankings include only COMPLETED orders, aggregate across orders, and calculate product revenue from quantity multiplied by the order-time price snapshot. No schema change was needed.

## Verification
Integration coverage includes empty totals, completed-only filtering, NEW, DELIVERING and CANCELLED exclusions, aggregation across completed orders, snapshot-price stability, five-item limiting, and deterministic ties. Focused tests passed 13/13; the full suite passed 36/36. Lint, TypeScript checking, mockup script syntax, independent review, and the production build passed.

## Next steps
No required follow-up.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
