'use client'

import { useState } from 'react'

interface LogFABProps {
  onVoice: () => void
  onCamera: () => void
  onType: () => void
  onQuickSelect: () => void
}

export default function LogFAB({
  onVoice,
  onCamera,
  onType,
  onQuickSelect,
}: LogFABProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
      {/* Expanded action buttons */}
      {expanded && (
        <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Quick select */}
          <button
            onClick={() => {
              onQuickSelect()
              setExpanded(false)
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-300 shadow-lg hover:bg-gray-700 transition-colors"
            aria-label="Quick select meal"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          </button>

          {/* Type / keyboard */}
          <button
            onClick={() => {
              onType()
              setExpanded(false)
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-300 shadow-lg hover:bg-gray-700 transition-colors"
            aria-label="Type food entry"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
              <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
              <path d="M8 16h8" />
            </svg>
          </button>

          {/* Camera */}
          <button
            onClick={() => {
              onCamera()
              setExpanded(false)
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-300 shadow-lg hover:bg-gray-700 transition-colors"
            aria-label="Scan food with camera"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
      )}

      {/* Expand / collapse toggle */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400 shadow-md hover:bg-gray-700 transition-all"
        aria-label={expanded ? 'Collapse options' : 'Expand options'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>

      {/* Main mic button */}
      <button
        onClick={onVoice}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 active:scale-95 transition-all"
        aria-label="Log food by voice"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    </div>
  )
}
