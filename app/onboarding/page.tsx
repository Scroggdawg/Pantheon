'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 0: Name
  const [name, setName] = useState('Luke')

  // Step 1: Height, DOB, Sex
  const [heightInches, setHeightInches] = useState(72)
  const [dob, setDob] = useState('1990-01-01')
  const [sex, setSex] = useState<'male' | 'female'>('male')

  // Step 2: Current weight + body fat
  const [currentWeight, setCurrentWeight] = useState(198)
  const [bodyFatPct, setBodyFatPct] = useState(25)

  // Step 3: Goal weight, goal date, rate
  const [goalWeight, setGoalWeight] = useState(185)
  const [goalDate, setGoalDate] = useState('2026-06-19')
  const [rate, setRate] = useState(1.3)

  // Step 4: Macro targets
  const [calories, setCalories] = useState(2250)
  const [protein, setProtein] = useState(200)
  const [fat, setFat] = useState(90)
  const [carbs, setCarbs] = useState(160)

  const totalSteps = 6

  function next() {
    if (step < totalSteps - 1) setStep(step + 1)
  }

  function back() {
    if (step > 0) setStep(step - 1)
  }

  async function handleComplete() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        height_in: heightInches,
        dob,
        sex,
        starting_weight_lbs: currentWeight,
        starting_bf_pct: bodyFatPct,
        goal_weight_lbs: goalWeight,
        goal_date: goalDate,
        goal_rate_lbs_per_week: rate,
        base_calories_target: calories,
        base_protein_g: protein,
        base_fat_g: fat,
        base_carbs_g: carbs,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to save')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none'
  const labelClass = 'block text-sm font-medium text-gray-400 mb-1'

  function formatHeight(inches: number) {
    const ft = Math.floor(inches / 12)
    const rem = inches % 12
    return `${ft}'${rem}"`
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Progress indicator */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">PANTHEON</h1>
          <p className="mt-1 text-sm text-gray-400">
            Step {step + 1} of {totalSteps}
          </p>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 0: Name */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What should we call you?</h2>
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
          </div>
        )}

        {/* Step 1: Height, DOB, Sex */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">About you</h2>
            <div>
              <label className={labelClass}>
                Height (inches) - {formatHeight(heightInches)}
              </label>
              <input
                type="number"
                value={heightInches}
                onChange={(e) => setHeightInches(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Date of birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'male' | 'female')}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Current weight + body fat */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Where you are now</h2>
            <div>
              <label className={labelClass}>Current weight (lbs)</label>
              <input
                type="number"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Body fat %</label>
              <input
                type="number"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Step 3: Goal weight, goal date, rate */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Where you want to be</h2>
            <div>
              <label className={labelClass}>Goal weight (lbs)</label>
              <input
                type="number"
                value={goalWeight}
                onChange={(e) => setGoalWeight(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Goal date</label>
              <input
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Rate (lbs/week)</label>
              <input
                type="number"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Step 4: Macro targets */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Daily macro targets</h2>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-4">
              <div>
                <label className={labelClass}>Calories</label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Protein (g)</label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fat (g)</label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Carbs (g)</label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div className="border-t border-gray-700 pt-3 text-sm text-gray-400">
                <p>
                  Macro calories: {protein * 4 + carbs * 4 + fat * 9} kcal
                  {protein * 4 + carbs * 4 + fat * 9 !== calories && (
                    <span className="ml-2 text-yellow-500">
                      (differs from target by{' '}
                      {Math.abs(protein * 4 + carbs * 4 + fat * 9 - calories)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review</h2>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span>{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Height</span>
                <span>{formatHeight(heightInches)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">DOB</span>
                <span>{dob}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sex</span>
                <span>{sex}</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between">
                <span className="text-gray-400">Current weight</span>
                <span>{currentWeight} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Body fat</span>
                <span>{bodyFatPct}%</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between">
                <span className="text-gray-400">Goal weight</span>
                <span>{goalWeight} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Goal date</span>
                <span>{goalDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span>{rate} lbs/week</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between">
                <span className="text-gray-400">Calories</span>
                <span>{calories}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Protein</span>
                <span>{protein}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fat</span>
                <span>{fat}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Carbs</span>
                <span>{carbs}g</span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={back}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-3 font-medium text-white hover:bg-gray-900 transition"
            >
              Back
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button
              onClick={next}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 transition"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Saving...' : "Let's go"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
