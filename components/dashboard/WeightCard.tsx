'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

interface WeightCardProps {
  latestWeight: number | null
  readings: { date: string; weight: number }[]
  lastSynced: string | null
  onSync?: () => Promise<{ success?: boolean; error?: string }>
  onManualEntry?: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function WeightCard({
  latestWeight,
  readings,
  lastSynced,
  onSync,
  onManualEntry,
}: WeightCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  const handleSync = async () => {
    if (!onSync || syncing) return
    setSyncing(true)
    setSyncError(null)
    setSyncSuccess(null)
    try {
      const result = await onSync()
      if (result.error) {
        setSyncError(result.error)
      } else {
        setSyncSuccess('Synced!')
        setTimeout(() => setSyncSuccess(null), 3000)
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6">
      <p className="text-sm text-gray-400 mb-1">Weight</p>

      {latestWeight !== null ? (
        <p className="text-4xl font-bold text-white tabular-nums">
          {latestWeight.toFixed(1)}{' '}
          <span className="text-lg font-normal text-gray-500">lbs</span>
        </p>
      ) : (
        <p className="text-xl text-gray-500 italic">Step on the scale</p>
      )}

      {readings.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readings}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#f9fafb',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {syncError && (
        <div className="mt-3 rounded-lg bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-300">
          {syncError}
        </div>
      )}
      {syncSuccess && (
        <div className="mt-3 rounded-lg bg-green-900/40 border border-green-800 px-3 py-2 text-sm text-green-300">
          {syncSuccess}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {lastSynced ? `Last synced ${timeAgo(lastSynced)}` : 'Not synced yet'}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={onManualEntry}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            Enter manually
          </button>
        </div>
      </div>
    </div>
  )
}
