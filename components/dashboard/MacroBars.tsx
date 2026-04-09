'use client'

interface MacroBarData {
  current: number
  target: number
}

interface MacroBarsProps {
  protein: MacroBarData
  carbs: MacroBarData
  fat: MacroBarData
}

const macros: {
  key: keyof MacroBarsProps
  label: string
  colorClass: string
  bgClass: string
}[] = [
  { key: 'protein', label: 'Protein', colorClass: 'bg-blue-500', bgClass: 'text-blue-400' },
  { key: 'carbs', label: 'Carbs', colorClass: 'bg-amber-500', bgClass: 'text-amber-400' },
  { key: 'fat', label: 'Fat', colorClass: 'bg-purple-500', bgClass: 'text-purple-400' },
]

export default function MacroBars({ protein, carbs, fat }: MacroBarsProps) {
  const data: Record<string, MacroBarData> = { protein, carbs, fat }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
      {macros.map(({ key, label, colorClass, bgClass }) => {
        const { current, target } = data[key]
        const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${bgClass}`}>{label}</span>
              <span className="text-sm text-gray-400 tabular-nums">
                {Math.round(current)}g / {Math.round(target)}g
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
