// Shared Anthropic client. Used by lib/claude/{recipe,workout,meal-plan}.ts
// and app/api/claude/{coach,score,daily-plan,parse-workout-image}/route.ts.
//
// S26 Step 3: parseMeal() wrapper deleted — the parse-meal route now calls
// runParseMealPipeline (lib/claude/parse-meal-pipeline.ts) directly so it
// can log telemetry (tokens, latency, tool-call summary).
//
// `client` export is retained — 7 active callers across the web repo;
// the H2 P-1 "drop client" call was based on an incomplete grep and is
// reversed in H3 §4.

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export { client }
