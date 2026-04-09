'use client'

interface CaloriesRemainingCardProps {
  remaining: number
  target: number
  consumed: number
}

export default function CaloriesRemainingCard({
  remaining,
  target,
  consumed,
}: CaloriesRemainingCardProps) {
  const colorClass =
    remaining < 0
      ? 'text-red-400'
      : remaining <= 300
        ? 'text-amber-400'
        : 'text-green-400'

  return (
    <div className="bg-gray-900 rounded-2xl p-6">
      <p className="text-sm text-gray-400 mb-1">Calories remaining</p>
      <p className={`text-5xl font-bold tabular-nums ${colorClass}`}>
        {remaining.toLocaleString()}
      </p>
      <p className="text-sm text-gray-500 mt-2">
        {consumed.toLocaleString()} of {target.toLocaleString()} consumed
      </p>
    </div>
  )
}
