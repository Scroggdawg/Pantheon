const MET_VALUES: Record<string, number> = {
  zone2_run: 7.0,
  zone2_bike: 5.5,
  zone2_row: 5.5,
  lift: 4.5,
  bjj: 8.5,
  walk: 3.5,
  hiit: 8.0,
  swim: 6.0,
  other: 5.0,
}

interface CalEstimateInput {
  session_type: 'lift' | 'bjj' | 'zone2' | 'other'
  duration_min: number | null
  distance_miles: number | null
  weight_lbs: number
  activity_detail?: string | null
}

interface CalEstimateResult {
  estimated_cal_burned: number
  cal_assumption: string
  duration_min_used: number
}

export function estimateCalories(input: CalEstimateInput): CalEstimateResult {
  const { session_type, duration_min, distance_miles, weight_lbs, activity_detail } = input
  const weight_kg = weight_lbs / 2.205

  // Determine MET value
  let met: number
  let activityLabel: string

  if (session_type === 'zone2') {
    const detail = activity_detail?.toLowerCase()
    if (detail === 'bike') {
      met = MET_VALUES.zone2_bike
      activityLabel = 'Zone 2 bike'
    } else if (detail === 'row') {
      met = MET_VALUES.zone2_row
      activityLabel = 'Zone 2 row'
    } else if (detail === 'swim') {
      met = MET_VALUES.swim
      activityLabel = 'Zone 2 swim'
    } else {
      met = MET_VALUES.zone2_run
      activityLabel = 'Zone 2 run'
    }
  } else if (session_type === 'bjj') {
    met = MET_VALUES.bjj
    activityLabel = 'BJJ'
  } else if (session_type === 'lift') {
    met = MET_VALUES.lift
    activityLabel = 'lifting session'
  } else {
    const detail = activity_detail?.toLowerCase()
    if (detail === 'walk') {
      met = MET_VALUES.walk
      activityLabel = 'walk'
    } else if (detail === 'hiit') {
      met = MET_VALUES.hiit
      activityLabel = 'HIIT'
    } else if (detail === 'swim') {
      met = MET_VALUES.swim
      activityLabel = 'swim'
    } else {
      met = MET_VALUES.other
      activityLabel = 'workout'
    }
  }

  // Determine duration
  let duration_min_used: number
  let durationSource: string

  if (duration_min && duration_min > 0) {
    duration_min_used = duration_min
    durationSource = `${duration_min} min`
  } else if (distance_miles && distance_miles > 0 && session_type === 'zone2') {
    const detail = activity_detail?.toLowerCase()
    if (detail === 'bike') {
      duration_min_used = Math.round((distance_miles / 15) * 60)
      durationSource = `${distance_miles} mi (~${duration_min_used} min at 15 mph)`
    } else {
      // Default to run pace: 12 min/mile
      duration_min_used = Math.round(distance_miles * 12)
      durationSource = `${distance_miles} mi (~${duration_min_used} min at 12 min/mi)`
    }
  } else {
    duration_min_used = 45
    durationSource = 'assumed 45 min'
  }

  // Calculate calories
  const calories = Math.round(met * weight_kg * (duration_min_used / 60))

  // Build assumption string
  const cal_assumption = `${durationSource} ${activityLabel} at ${Math.round(weight_lbs)} lbs`

  return {
    estimated_cal_burned: calories,
    cal_assumption,
    duration_min_used,
  }
}
