import { createHash, createHmac, randomUUID } from 'crypto'

// Wyze Scale X (WL_SC3) uses the Pluto service
const WYZE_AUTH_URL = 'https://auth-prod.api.wyze.com/api/user/login'
const WYZE_PLUTO_BASE = 'https://wyze-pluto-service.wyzecam.com'
const WYZE_API_BASE = 'https://api.wyzecam.com'
const WYZE_APP_ID = '9319141212m2ik'
const WYZE_APP_INFO = 'wyze_android_2.19.14'
const WYZE_SALT = 'wyze_app_secret_key_132'
const WYZE_X_API_KEY = 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm'

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex')
}

function tripleMd5(password: string): string {
  return md5(md5(md5(password)))
}

function hmacMd5(key: string, data: string): string {
  return createHmac('md5', key).update(data).digest('hex')
}

export interface WyzeScaleRecord {
  data_id: string
  measure_ts: number
  weight: number // kg
  body_fat: number
  muscle: number
  bone_mineral: number
  body_water: number
  body_vfr: number
  bmi: number
  bmr: number
  protein: number
  metabolic_age: number
  family_member_id: string
}

interface WyzeAuth {
  access_token: string
  refresh_token: string
  user_id: string
}

let cachedAuth: { auth: WyzeAuth; expires: number } | null = null

export function checkWyzeCredentials(): string | null {
  if (!process.env.WYZE_EMAIL) return 'WYZE_EMAIL not set'
  if (!process.env.WYZE_PASSWORD) return 'WYZE_PASSWORD not set'
  if (!process.env.WYZE_KEY_ID) return 'WYZE_KEY_ID not set'
  if (!process.env.WYZE_API_KEY) return 'WYZE_API_KEY not set'
  return null
}

export async function getWyzeAuth(): Promise<WyzeAuth> {
  if (cachedAuth && Date.now() < cachedAuth.expires) {
    return cachedAuth.auth
  }

  const credError = checkWyzeCredentials()
  if (credError) throw new Error(credError)

  const nonce = String(Date.now())
  const phoneId = randomUUID()

  const response = await fetch(WYZE_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': WYZE_X_API_KEY,
      'apikey': process.env.WYZE_API_KEY!,
      'keyid': process.env.WYZE_KEY_ID!,
      'User-Agent': WYZE_APP_INFO,
      'appid': WYZE_APP_ID,
      'appinfo': WYZE_APP_INFO,
      'phoneid': phoneId,
    },
    body: JSON.stringify({
      nonce,
      email: process.env.WYZE_EMAIL,
      password: tripleMd5(process.env.WYZE_PASSWORD!),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Wyze auth failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const data = await response.json()

  if (!data.access_token) {
    throw new Error(`Wyze auth: no access_token in response: ${JSON.stringify(data).slice(0, 200)}`)
  }

  const auth: WyzeAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
  }

  cachedAuth = { auth, expires: Date.now() + 55 * 60 * 1000 }
  return auth
}

function buildPlutoHeaders(accessToken: string, params: Record<string, string>): Record<string, string> {
  const nonce = String(Date.now())
  const phoneId = randomUUID()

  // Sort params and join for signature
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  // Signing key = md5(access_token + salt)
  const signingKey = md5(accessToken + WYZE_SALT)
  const signature2 = hmacMd5(signingKey, sortedParams)

  return {
    'Accept-Encoding': 'gzip',
    'User-Agent': WYZE_APP_INFO,
    'appid': WYZE_APP_ID,
    'appinfo': WYZE_APP_INFO,
    'phoneid': phoneId,
    'access_token': accessToken,
    'requestid': md5(md5(nonce)),
    'signature2': signature2,
  }
}

export async function fetchScaleRecords(auth: WyzeAuth): Promise<WyzeScaleRecord[]> {
  const now = Date.now()
  const oneDayAgo = now - 86400000

  const params: Record<string, string> = {
    family_member_id: auth.user_id,
    start_time: String(oneDayAgo),
    end_time: String(now),
    forward: '0',
    nonce: String(now),
  }

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

  const headers = buildPlutoHeaders(auth.access_token, params)

  const url = `${WYZE_PLUTO_BASE}/plugin/pluto/get_record_range?${queryString}`

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Wyze scale fetch failed (${response.status}): ${body.slice(0, 300)}`)
  }

  const data = await response.json()
  return data.data || []
}

const KG_TO_LBS = 2.20462

export function parseScaleRecord(record: WyzeScaleRecord) {
  return {
    measured_at: new Date(record.measure_ts * 1000).toISOString(),
    weight_lbs: Number((record.weight * KG_TO_LBS).toFixed(1)),
    body_fat_pct: record.body_fat || null,
    muscle_mass_lbs: record.muscle
      ? Number((record.muscle * KG_TO_LBS).toFixed(1))
      : null,
    bone_mass_lbs: record.bone_mineral
      ? Number((record.bone_mineral * KG_TO_LBS).toFixed(1))
      : null,
    water_pct: record.body_water || null,
    visceral_fat: record.body_vfr ? Math.round(record.body_vfr) : null,
    bmi: record.bmi || null,
    wyze_record_id: record.data_id,
    source: 'wyze_sync' as const,
  }
}
