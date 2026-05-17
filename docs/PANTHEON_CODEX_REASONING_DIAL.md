# Pantheon Codex Reasoning Dial

Date: 2026-05-17
Status: Active doctrine for Codex sessions on Pantheon

## ELI5

Use the default brain for ordinary mechanical work. Use the careful brain when a wrong answer can quietly poison Pantheon's memory, ship a bad native build, break parser trust, or make Luke review the same mess twice.

Medium is the normal gear. High is for doctrine, risk, parser behavior, live data writes, and ambiguous food identity. Low is only for tiny read-only lookups or mechanical formatting.

## Default Gear: Medium

Use medium reasoning for:

- reading repo context and summarizing status;
- routine docs and handoff updates;
- small scoped code edits with obvious tests;
- pack-file formatting and static validation;
- dry-runs that do not write live data;
- straightforward git status, commit, and push after checks;
- answering "what happened?" or "what is next?" from already-known facts.

Medium is enough when the task has a clear local pattern, low ambiguity, and the failure mode is easy to notice.

## Turn Up To High

Use high reasoning before:

- live Supabase writes, including product inserts, alias applies, rejection ledgers, and cache-affecting writes;
- any Pantry Lightning apply, even under the 25 cap;
- food identity decisions where nearby foods differ by prep state, leanness, fat level, brand, recipe/composite status, or raw/cooked state;
- parser/matcher/risk engine changes;
- reviewing auto-approved pantry rows for bad-match classes;
- designing a new lightning round from purchase history, Instacart, Amazon, restaurant history, or Luke's speech patterns;
- changing native release, EAS, OTA, Vercel production, auth, secrets, migrations, or shared data contracts;
- writing doctrine that future Codex sessions will rely on;
- resolving conflicting handoffs or stale docs;
- deciding whether to generalize a food alias under the 10% practical-equivalence rule.

High is required when the task is not just "make the code work," but "decide what should be trusted."

## Consider Extra-High

Use extra-high only for rare work where multiple systems interact and a bad decision is expensive to unwind:

- native release/update/submit strategy;
- schema migrations touching production data semantics;
- broad parser architecture or confidence-model redesign;
- deleting or rewriting live pantry/library data;
- reconciling contradictory doctrine from multiple prior Codexes;
- investigating a production outage or user-facing parse regression.

Extra-high should be deliberate and named in the working notes.

## Low Gear

Low reasoning is acceptable for:

- checking the current time/date;
- listing files;
- quoting a command result;
- fixing obvious typos;
- formatting-only doc cleanup;
- rerunning a known passing command after no relevant changes.

Do not use low for anything that writes live data, changes parser behavior, or makes a food identity judgment.

## Pantry Sorting Hat

When a pantry task arrives, classify it first:

- **Green mechanical:** docs, tests, dry-runs, status reports, static pack validation. Medium.
- **Green analytical:** finding duplicate aliases, mining artifacts, summarizing held rows. Medium until identity judgment starts, then high.
- **Yellow live alias:** generic-equivalence alias apply under cap. High.
- **Yellow live product:** USDA auto-approved product apply under `--max-insert=25`. High.
- **Red/stop:** branded/OFF/restaurant/alcohol/supplement/recipe/composite/LLM-estimated product writes, cap raises, migrations, destructive git, secrets, native EAS/release flows. High or extra-high, and ask Luke unless explicitly pre-approved.

If a task crosses categories, use the higher gear.

## Food Identity Rule

Any time Codex is deciding whether two foods are "the same enough," use high reasoning and check:

- same practical food;
- same prep state;
- same edible portion;
- no brand/prepared-food trap;
- no raw/cooked, dry/cooked, fried/raw, light/full-fat, leanness, yolk/white, pickled/raw, or composite mismatch;
- roughly within Luke's generic-equivalence rule: about 10% or 10 kcal per 100g, with no structural macro difference.

If the answer is "probably, but the target product does not exist yet," create or plan the anchor first. Do not alias to the wrong nearby product.

## Operating Promise

Luke can leave the app setting at medium. Codex should internally upshift when the work type demands it, especially for live pantry memory, parser trust, or release risk.

The visible behavior should be:

- more careful dry-run inspection before live writes;
- explicit stop conditions;
- short but real handoffs after meaningful batches;
- no fake certainty when the right move is to hold a row for an anchor or review.
