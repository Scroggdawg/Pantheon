# Quartermaster Plan

Date: 2026-05-17
Status: Planning doctrine. Build after final Instacart branded pilot.

## Core Doctrine

User experience feedback is the Bible.

Pantheon should not primarily learn from what Codex thinks should work, what a model says is high confidence, or what a clean database design prefers. Pantheon should learn from what actually happens when Luke uses the app.

Every parse is a training event:

- a clean save teaches what works;
- an edit teaches what was close but wrong;
- a deletion teaches what should not have appeared;
- a swap teaches identity failure;
- a quantity edit teaches unit or portion failure;
- a failed save teaches infrastructure fragility;
- a slow parse teaches missing fast-path knowledge;
- a joke or non-log query teaches intent classification.

## Mission

Quartermaster is Pantheon's self-auditing learning loop. It periodically inspects real usage since the last run, grades outcomes, diagnoses failures, and routes fixes to the right work lane.

Quartermaster does not need to run 24/7 at first. It should start as a session tool: run a cycle, produce a report, create reviewable proposals, and let Luke/Codex decide what to apply.

## Cycle

### 1. Ingest

Pull evidence since the last Quartermaster run:

- `food_log_entries`;
- raw input text;
- parsed foods and `claude_parse_json`;
- parser telemetry;
- save failures;
- Plate edits, removals, swaps, and quantity changes;
- user corrections and reports;
- stale saved-meal refs;
- latency and fallback-path signals.

### 2. Grade

Classify each interaction:

- `clean_success`: saved quickly, no correction signal;
- `slow_success`: saved, but latency or fallback path was poor;
- `edited_success`: saved after quantity/unit/macro edits;
- `identity_failure`: user swapped one food identity for another;
- `quantity_unit_failure`: right identity, wrong amount or unit;
- `coverage_failure`: low confidence, null source, or no durable identity;
- `confidently_wrong`: high confidence followed by edit/delete/swap;
- `save_path_failure`: parse was acceptable but logging failed;
- `joke_or_non_log`: user was not trying to log food;
- `ambiguous_review`: not enough evidence to infer intent safely.

### 3. Diagnose

Attach likely causes:

- missing alias;
- missing product;
- bad generic collapse;
- stale saved-meal identity;
- unit conversion gap;
- branded exact product needed;
- voice transcript ambiguity;
- parser overconfidence;
- slow LLM fallback;
- user intent was not food logging.

### 4. Route

Create work packets for:

- Pantry Forge: products, units, aliases;
- Matcher: ranking, stale refs, rejected aliases;
- Parser: utterance decomposition and joke/non-log detection;
- Native UX: edit friction and missing feedback plumbing;
- Regression: golden tests from real failures;
- Human review: ambiguous intent or risky data writes.

### 5. Propose, Do Not Mutate Blindly

Quartermaster should create reviewable proposals first:

- add alias;
- reject alias;
- add product;
- add unit conversion;
- clean stale identity;
- add parser regression;
- classify joke/non-log;
- investigate recurring cluster.

Approved proposals can later become writes to aliases, rejections, pantry products, saved-meal repairs, tests, or parser rules.

## Scoreboard

Quartermaster should report:

- parse success rate;
- save success rate;
- edit rate;
- delete/swap rate;
- latency;
- fast-path hit rate;
- fallback LLM rate;
- confidently-wrong rate;
- top failed phrases;
- top missing foods;
- top bad matches;
- top user-friction flows.

## First Implementation Pass

Create:

- `scripts/report-quartermaster-cycle.ts`
- `docs/handoffs/PANTHEON_S28_HIVE_QUARTERMASTER_1.md`

Initial behavior:

- read logs since last run;
- output markdown under `scripts/output/`;
- make no live mutations;
- classify outcomes with conservative heuristics;
- produce reviewable proposal sections.

Initial heuristics:

- saved with no edit signal = likely success;
- failed save = save-path failure;
- low confidence or null `source_ref` = coverage gap;
- stale saved-meal ref ignored = stale identity issue;
- long latency or LLM fallback = speed issue;
- high confidence followed by delete/swap/edit = confidently wrong.

## Relationship To Pantry Forge

Pantry Forge asks: what foods should exist, and how should they convert?

Quartermaster asks: did those foods actually help Luke log faster and more accurately?

Forge builds the pantry. Quartermaster audits reality. Together they become the learning loop.

## Stop Conditions

Quartermaster must not silently apply:

- broad aliases;
- branded product writes;
- saved-meal identity rewrites;
- destructive cleanup;
- schema migrations;
- parser behavior changes.

It may propose them, but human or explicit Codex approval is required before live mutation.
