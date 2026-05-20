# Pantheon Quartermaster Product Worklist

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; read-only, no production writes.

## Plain English

Quartermaster now has several useful product reports, but Luke should not have to read five reports to know what to do next.

This worklist is the "what matters first" layer. It consolidates:

- product identity health
- saved-meal source-ref cleanup
- barcode quality
- external OFF/USDA promotion candidates
- protein shake composition risk

The goal is not to patch every tiny issue. The goal is to turn real usage into a small number of high-value repair packets.

## Current Next Move

Run:

```bash
npx tsx scripts/report-quartermaster-product-worklist.ts
```

This creates a ranked execution plan from live read-only data.

## Product Doctrine

1. User behavior is stronger than theory.
2. Repeated clean saves are promotion evidence.
3. Edits after save/scan are repair evidence.
4. Barcode scans should strengthen product identity, not create a parallel identity universe.
5. Protein shakes should support friendly shortcuts, but custom quantities belong to ingredient math.
6. Saved-meal source refs must point to durable identities or stay null. They should not point to hourly recall wrappers.
7. Any production data mutation needs integration review and explicit approval.

## Expected Work Packets

### Retire hourly wrapper refs

Some saved meals still contain `lib:hourly_go_to:*` source refs inside their component JSON. These are memory wrappers, not durable identities.

Correct outcome:

- map to a real product or saved meal when the match is reviewed
- leave null when the component is truly manual
- never self-map a saved meal back to itself

### Promote repeated external products

External `off:*` and `usda:*` refs are fine as evidence, but repeated clean saves can justify a reviewed product row.

Correct outcome:

- keep one-off observations as watch evidence
- review repeated foods like Harmless Harvest coconut water before product creation
- preserve barcode/provenance when promoting

### Classify barcode failures

Barcode failures are not just errors. They tell Quartermaster whether scanning failed because of camera/permission, lookup miss, incomplete macros, or fallback parse.

Correct outcome:

- repeated failures become coverage work
- edited scanned products become unit/fact repair work
- telemetry failure never blocks the user from logging

### Protect protein shake composition

Protein shakes are a high-value identity test. They need fast common shortcuts and strong custom quantity handling.

Correct outcome:

- common phrases can resolve quickly
- "two scoops protein" and "half dextrose" should be component math
- do not create an identity for every quantity combination

## Stop Rules

- Do not mutate production data from this worklist.
- Do not merge or deploy PR #12 without integration review because it touches `package.json`.
- Do not promote OFF/USDA products from one observation.
- Do not create broad aliases from barcode evidence alone.
- Do not reintroduce hourly refs as durable identities.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A
Plain English: Quartermaster should turn real logging evidence into a short, ranked repair list instead of creating piles of tiny disconnected patches.
