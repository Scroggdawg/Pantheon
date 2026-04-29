import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });

    // verbose_json shape includes duration + language; the SDK's union type
    // doesn't narrow on response_format, so cast at the boundary.
    const verbose = result as unknown as {
      text: string;
      duration: number;
      language: string;
    };

    return NextResponse.json({
      transcript: verbose.text,
      duration_seconds: verbose.duration,
      language: verbose.language,
    });
  } catch (err) {
    console.error("[whisper/transcribe] error:", err);
    const msg =
      err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
