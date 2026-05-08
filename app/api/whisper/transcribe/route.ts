// Op FASTRAK Alpha.2 + Alpha.3 — Whisper vocabulary hint + telemetry capture.
//
// Pre-Alpha: vanilla whisper-1 call with no prompt/language hint and no
// telemetry. Pantheon's domain (brand names, restaurant terms, supplement
// + food taxonomy) is exactly what Whisper's `prompt` parameter is for —
// adding a short list of known foods/brands biases transcription toward
// the right tokens (Spindrift vs Spendthrift, Yerba Mate vs Madre
// Enlightenment, dos xx vs Dos XX).
//
// Telemetry shape lands in food_log_entries.claude_parse_json._telemetry
// via the parse-meal route (which now accepts an optional whisper_telemetry
// field in its request body and merges into the response telemetry).
// Native client is responsible for forwarding the whisper_* fields from
// the transcribe response to the parse-meal request — that's a native
// follow-on, not in scope for this web bundle.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { buildVocabString } from "@/lib/whisper/vocab";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid audio field" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Build vocabulary hint from Luke's library + recent log. Best-effort
    // — if the supabase resolution fails for any reason, we transcribe
    // without a hint (regression to pre-Alpha.2 behavior, never blocks
    // transcription).
    let prompt: string | undefined = undefined;
    let promptCharCount = 0;
    let promptSourceCount = 0;
    let promptTruncated = false;
    try {
      const supabase = await createClient();
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .limit(1)
        .single();
      if (userRow?.id) {
        const vocab = await buildVocabString(supabase, userRow.id);
        if (vocab.prompt.length > 0) {
          prompt = vocab.prompt;
          promptCharCount = vocab.char_count;
          promptSourceCount = vocab.source_count;
          promptTruncated = vocab.truncated;
        }
      }
    } catch (vocabErr) {
      console.warn(
        "[whisper/transcribe] vocab build failed (transcribing without hint):",
        vocabErr
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const whisperStarted = Date.now();
    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      ...(prompt ? { prompt } : {}),
    });
    const whisperLatencyMs = Date.now() - whisperStarted;

    // verbose_json shape includes duration + language; the SDK's union type
    // doesn't narrow on response_format, so cast at the boundary.
    const verbose = result as unknown as {
      text: string;
      duration: number;
      language: string;
    };

    const audioDurationMs = Math.round((verbose.duration ?? 0) * 1000);

    // Op FASTRAK Alpha.3 — structured log line for runtime visibility
    // (Vercel Hobby retention is ~1h; persistent storage flows via the
    // parse-meal pipeline merge when the client forwards whisper_telemetry).
    console.log({
      type: "whisper_telemetry",
      whisper_audio_duration_ms: audioDurationMs,
      whisper_latency_ms: whisperLatencyMs,
      whisper_prompt_tokens: promptCharCount, // char-count proxy (Whisper tokenizer ≠ tiktoken cl100k_base)
      whisper_prompt_truncated: promptTruncated,
      whisper_prompt_source_count: promptSourceCount,
      whisper_language: verbose.language,
    });

    return NextResponse.json({
      transcript: verbose.text,
      duration_seconds: verbose.duration,
      language: verbose.language,
      // Alpha.3 layer 2 — return whisper_* fields to client for forward
      // to /api/claude/parse-meal. Field names match the persistence
      // shape inside food_log_entries.claude_parse_json._telemetry.
      whisper_audio_duration_ms: audioDurationMs,
      whisper_latency_ms: whisperLatencyMs,
      whisper_prompt_tokens: promptCharCount,
      whisper_prompt_truncated: promptTruncated,
    });
  } catch (err) {
    console.error("[whisper/transcribe] error:", err);
    const msg =
      err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
