import { createClient } from '@/lib/supabase/server'
import { assertCanonicalUserId, PantheonUserError } from '@/lib/pantheon-user'

const EVENT_TYPES = new Set([
  'parse_requested',
  'parse_returned',
  'parse_failed',
  'parse_abandoned',
  'food_item_edited',
  'food_item_deleted',
  'food_item_added',
  'disambiguation_selected',
  'save_requested',
  'save_succeeded',
  'save_failed',
  'quick_add_after_parse',
  'retry_after_parse',
  'barcode_scan_started',
  'barcode_scan_resolved',
  'barcode_scan_failed',
  'barcode_product_selected',
  'barcode_product_edited',
  'barcode_log_saved',
])

interface FoodLogEventBody {
  user_id: string
  food_log_entry_id?: string | null
  session_id?: string | null
  event_type: string
  raw_input_text?: string | null
  payload?: Record<string, unknown> | null
  client_platform?: string | null
  app_version?: string | null
}

function bad(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status })
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function cleanPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(request: Request) {
  let body: FoodLogEventBody
  try {
    body = (await request.json()) as FoodLogEventBody
  } catch {
    return bad(400, 'invalid JSON body')
  }

  if (!EVENT_TYPES.has(body.event_type)) return bad(400, 'invalid event_type')

  const supabase = await createClient()
  let userId: string
  try {
    userId = await assertCanonicalUserId(supabase, body.user_id)
  } catch (error) {
    if (error instanceof PantheonUserError) return bad(error.status, error.message)
    throw error
  }

  const { data, error } = await supabase
    .from('food_log_events')
    .insert({
      user_id: userId,
      food_log_entry_id: cleanString(body.food_log_entry_id, 80),
      session_id: cleanString(body.session_id, 120),
      event_type: body.event_type,
      raw_input_text: cleanString(body.raw_input_text, 2000),
      payload: cleanPayload(body.payload),
      client_platform: cleanString(body.client_platform, 80),
      app_version: cleanString(body.app_version, 80),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[food-log-events] insert failed:', error?.message)
    return bad(500, `food_log_events insert failed: ${error?.message ?? 'unknown'}`)
  }

  return Response.json({ food_log_event_id: data.id })
}
