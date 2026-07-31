# Finance — Company income display (architecture)

**Status:** LOCKED for beachhead UI  
**Date:** 2026-07-31  
**Surface:** Admin → Finance → Home (not City Home, not Marketing)

---

## 1. What “company income” must mean

For VUUSH, three numbers are easy to confuse. Only one should be the hero.

| Name | Meaning | Hero? |
|------|---------|-------|
| **Gross volume** | Sum of job prices (card + statement lines) | No — size theatre |
| **Cash collected** | Paystack captures in the period | Supporting |
| **Company income (net take)** | What VUUSH keeps after driver share accrues (before opex) | **Yes — hero** |
| **Receivables** | Issued org statements not yet paid outside | Supporting later |
| **Profit** | After payouts, refunds, costs, tax | Later — needs full books |

**Lock:** Hero = **Company income (net take)** for the selected period.  
Demo beachhead value: **R 350,000** until live rollup ships.

Never label driver payouts as “income.” Never show a vanity GMV as the only figure.

---

## 2. Best placement

| Option | Verdict |
|--------|---------|
| Admin City / general Home | **Reject** — ops health ≠ money desk |
| Finance → Home top | **Adopt** — money truth before queues |
| Separate Finance app | Rejected (Wave-2 D1) |
| Chart-heavy BI wall | Reject — Wave-4 / noise |

**Order on Finance Home:**

1. Page title + one line of purpose  
2. **Income composition** (hero + 2–3 supports)  
3. **Needs you** (action queues)  
4. Quiet helper copy (thresholds)

Action never outranks understanding of money.

---

## 3. Design knowledge (applied)

- **One hero number** — largest type; everything else quieter.  
- **Composition over cards** — hairline rules / type hierarchy; avoid equal card grids for money truth.  
- **Honest demo** — mark Demo until calculated from ledger.  
- **Period always visible** — “This month” (demo) so the number has a frame.  
- **Support trio** — Gross volume · Driver share · Cash collected (context, not competitors).  
- **Queues second** — failed pays / freezes / adjustments as a worklist, smaller.  
- VUUSH calm: white field, grey secondary, black mark — no purple glow, no KPI sticker pile.

---

## 4. Live calculation (later — not this UI pass)

When demo flag turns off:

```
company_income ≈
  sum(captured payments in period)
  + sum(org statement lines issued in period)
  − sum(refunds / credit notes in period)
  − sum(earning_lines created in period)   // driver share
```

Freeze does not change income recognition; it only blocks payout.  
Document any change in Finance notes before flipping `isDemo`.

---

## 5. Approval

Beachhead UI follows this doc. Hero remains demo R350k until founder asks for live rollup.
