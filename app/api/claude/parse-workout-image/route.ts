import { client } from '@/lib/claude/claude'
import { createClient } from '@/lib/supabase/server'
import { estimateCalories } from '@/lib/claude/calories'

const MAX_IMAGE_BASE64_CHARS = 10_000_000

const WORKOUT_IMAGE_SYSTEM_PROMPT = `This is a handwritten gym workout. Parse every exercise you can read into structured JSON:
{
  "session_type": "lift|bjj|zone2|other",
  "duration_min": number|null,
  "exercises": [
    {
      "exercise_name": "string",
      "muscle_groups": ["string"],
      "sets": [{ "reps": number, "weight_lbs": number }],
      "total_volume_lbs": number,
      "notes": "string|null"
    }
  ],
  "total_volume_lbs": number,
  "distance_miles": number|null,
  "activity_detail": "run|bike|row|swim|walk|null",
  "notes": "string|null",
  "clarification_needed": "string|null"
}
Common shorthand: RDL = Romanian deadlift, DB = dumbbell, BB = barbell, RP = rest-pause, AMRAP = as many reps as possible, BW = bodyweight.
If weight is unclear, set weight_lbs to null. Infer muscle_groups from exercise names. Calculate total_volume_lbs = sum of (reps * weight) across all sets.
If distance is mentioned or visible, include it as distance_miles. If the activity is a specific type of zone2 (run, bike, row, swim) or a walk, set activity_detail accordingly. For lifting, set both to null.
Return ONLY valid JSON.`

export async function POST(request: Request) {
  try {
    const { image, mediaType } = await request.json()

    if (!image || typeof image !== 'string') {
      return Response.json({ error: 'image (base64) is required' }, { status: 400 })
    }
    if (image.length > MAX_IMAGE_BASE64_CHARS) {
      return Response.json(
        { error: 'image is too large' },
        { status: 413 },
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    const mt = mediaType || 'image/jpeg'
    if (mt === 'image/heic' || mt === 'image/heif') {
      return Response.json({ error: 'HEIC images must be converted before upload' }, { status: 400 })
    }
    if (!validTypes.includes(mt)) {
      return Response.json({ error: 'Unsupported image type' }, { status: 400 })
    }

    console.log('[parse-workout-image] Parsing image...')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: WORKOUT_IMAGE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mt as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: image,
              },
            },
            { type: 'text', text: 'Parse this workout.' },
          ],
        },
      ],
    })

    const block = response.content[0]
    let text = block.type === 'text' ? block.text : ''
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    const parsed = JSON.parse(text)
    console.log('[parse-workout-image] Success:', parsed.exercises?.length, 'exercises')

    // Fetch most recent weight for calorie estimation
    let weightLbs = 198
    try {
      const supabaseWeight = await createClient()
      const { data: weightRow } = await supabaseWeight
        .from('weight_readings')
        .select('weight_lbs')
        .order('measured_at', { ascending: false })
        .limit(1)
        .single()
      if (weightRow?.weight_lbs) weightLbs = Number(weightRow.weight_lbs)
    } catch {
      console.warn('[parse-workout-image] Weight fetch failed, using 198 lbs default')
    }

    const calResult = estimateCalories({
      session_type: parsed.session_type,
      duration_min: parsed.duration_min,
      distance_miles: parsed.distance_miles ?? null,
      weight_lbs: weightLbs,
      activity_detail: parsed.activity_detail ?? null,
    })

    // Upload image to Supabase Storage instead of storing base64 in DB
    let imageUrl: string | null = null
    try {
      const supabase = await createClient()
      const buffer = Buffer.from(image, 'base64')
      const ext = mt === 'image/png' ? 'png' : mt === 'image/webp' ? 'webp' : 'jpg'
      const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('workout-images')
        .upload(filename, buffer, { contentType: mt, upsert: false })

      if (uploadError) {
        console.warn('[parse-workout-image] Storage upload failed:', uploadError.message)
      } else {
        const { data: urlData } = supabase.storage
          .from('workout-images')
          .getPublicUrl(filename)
        imageUrl = urlData.publicUrl
      }
    } catch {
      console.warn('[parse-workout-image] Storage upload failed, continuing without image URL')
    }

    return Response.json({
      ...parsed,
      imageUrl,
      estimated_cal_burned: calResult.estimated_cal_burned,
      cal_assumption: calResult.cal_assumption,
      distance_miles: parsed.distance_miles ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[parse-workout-image] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
