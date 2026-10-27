---
title: Shop revenue and task totals
date: 2026-10-27
summary: Added primary all-system revenue and task cards to the shop information page.
---

# Shop revenue and task totals

## What happened
The shop information page only contained editable contact details. It did not show the two shop-wide indicators requested by the owner.

## Decision
Add two primary cards above the contact form. Total revenue sums order totals only when status is COMPLETED. Total work counts every order currently stored in the system, including CANCELLED orders. No schema change is required.

## Verification
Added an integration test for the empty state and mixed NEW, COMPLETED, and CANCELLED orders. Typecheck, lint, all 35 tests, and the production build passed. The 375px layout stacks the cards to avoid number overflow.

## Next steps
Choose which additional shop overview indicators should be implemented next.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
