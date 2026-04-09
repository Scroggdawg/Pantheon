'use client'

import { DayType, DAY_TYPE_ADJUSTMENTS } from '@/types/database'

interface DayTypeToggleProps {
  value: DayType | null
  onChange: (type: DayType) => void
}

const dayTypes: DayType[] = ['lift', 'zone2', 'rest']

export default function DayTypeToggle({ value, onChange }: DayTypeToggleProps) {
  return (
    <div className="flex gap-2">
      {dayTypes.map((type) => {
        const { emoji, label } = DAY_TYPE_ADJUSTMENTS[type]
        const isActive = value === type

        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
