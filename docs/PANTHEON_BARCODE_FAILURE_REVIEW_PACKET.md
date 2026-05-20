# Barcode Failure Review Packet

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; review-only, no production writes.

## Plain English

Barcode failures should not all become the same kind of task.

Some failures mean "we need a product." Some mean "we found something, but the macros were incomplete." Some mean "the camera or permission flow had trouble." Quartermaster should sort those for us.

## Command

```bash
npx tsx scripts/report-barcode-failure-review.ts
```

## Buckets

### Missing Product Coverage

The barcode did not match a usable product.

Next action:

- watch for repeats
- use Luke confirmation or label facts before adding product coverage

### Incomplete Macros

The lookup path found no durable product with complete macros.

Next action:

- check whether the user still saved an external result
- if repeated, review it for product promotion

### Camera Or Permission

The scan failed before product lookup.

Next action:

- route to native UI
- do not treat as pantry work

### Fallback Parse

The barcode path had a failure event, but the user still logged something from barcode fallback.

Next action:

- keep watching for edit friction
- do not treat as blocking unless saves fail

### Unknown

Telemetry is not rich enough yet.

Next action:

- improve event payloads if repeated

## Current Live Read

The current known failure is barcode `632432737775`, classified as incomplete macros / product coverage work.

Plain English: scanning did not find a durable product with complete macros, but Luke still saved `Yerba Mate Organic Revel Berry` from an external source. That means the scanner worked well enough to log, but Quartermaster should watch whether this should become a reviewed product later.

## Stop Rules

- Do not create a product from one failed scan.
- Do not create broad aliases from barcode misses.
- Do not route camera/permission bugs to Pantry Forge.
- Do not block food logging because telemetry failed.
- Any product creation needs label/source verification and explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: Quartermaster can now turn barcode failures into the right kind of repair task instead of treating every scan miss as the same problem.
