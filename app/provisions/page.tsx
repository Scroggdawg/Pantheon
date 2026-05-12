'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import MarbleBackground from '@/components/ui/MarbleBackground'
import SectionDivider from '@/components/ui/SectionDivider'
import { AddRecipePanel } from '@/components/provisions/AddRecipePanel'
import PlanView from '@/components/provisions/PlanView'
import type { Recipe } from '@/types/database'

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'
const TEXT_MUTED = '#8a7a60'

export default function ProvisionsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/recipes')
    if (!res.ok) {
      let msg = `Failed to fetch recipes (${res.status})`
      try {
        const body = await res.json()
        if (body && typeof body.error === 'string') msg = body.error
      } catch {}
      setError(msg)
      setLoading(false)
      return
    }
    const data = await res.json()
    setRecipes((data ?? []) as Recipe[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => {
      void fetchRecipes()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user, fetchRecipes])

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#eae5de' }}>
        <div style={{ color: 'rgba(70,48,12,0.5)' }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push('/onboarding')
    return null
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#eae5de' }}>
      <MarbleBackground />

      {/* Sticky Nav */}
      <div
        className="sticky top-0 z-50 flex justify-between items-center px-4 py-3"
        style={{ backgroundColor: 'rgba(234,229,222,0.95)' }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: TEXT_DARK }}
        >
          PROVISIONS
        </span>
        <Link
          href="/dashboard"
          className="text-[11px] uppercase tracking-[0.15em] font-semibold hover:opacity-70 transition-opacity"
          style={{ color: GOLD_LIGHT }}
        >
          &larr; PANTHEON
        </Link>
      </div>

      <div className="relative z-10 space-y-6 px-4 pt-2">
        <SectionDivider label="This Week" />

        <PlanView
          recipes={recipes}
          recipesLoading={loading}
          userReady={!!user}
        />

        <SectionDivider label="Recipe Library" />

        <AddRecipePanel onSaved={fetchRecipes} />

        {/* Recipe Library */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div
                className="h-6 w-6 animate-spin rounded-full border-4"
                style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: GOLD_LIGHT }}
              />
            </div>
          ) : error ? (
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                background: 'rgba(180,40,40,0.08)',
                border: '1px solid rgba(180,40,40,0.2)',
                color: '#7a2222',
              }}
            >
              {error}
            </div>
          ) : recipes.length === 0 ? (
            <div
              className="rounded-2xl p-6 text-center text-sm"
              style={{
                background: 'rgba(255,253,249,0.45)',
                border: '1px solid rgba(201,160,60,0.15)',
                color: TEXT_MUTED,
              }}
            >
              No recipes yet. Paste one above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,253,249,0.55)',
                    border: '1px solid rgba(201,160,60,0.18)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
                      {recipe.name}
                    </h3>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: TEXT_MUTED }}>
                      {recipe.servings} {Number(recipe.servings) === 1 ? 'serving' : 'servings'}
                    </span>
                  </div>

                  {(recipe.calories !== null || recipe.protein_g !== null || recipe.carbs_g !== null || recipe.fat_g !== null) && (
                    <div className="text-xs mb-2" style={{ color: TEXT_MID }}>
                      {recipe.calories !== null && <span style={{ color: GOLD }}>{Math.round(Number(recipe.calories))} cal</span>}
                      {recipe.calories !== null && (recipe.protein_g !== null || recipe.carbs_g !== null || recipe.fat_g !== null) && (
                        <span style={{ color: TEXT_MUTED }}> · </span>
                      )}
                      {recipe.protein_g !== null && <span>{Number(recipe.protein_g).toFixed(0)}P</span>}
                      {recipe.protein_g !== null && (recipe.carbs_g !== null || recipe.fat_g !== null) && ' · '}
                      {recipe.carbs_g !== null && <span>{Number(recipe.carbs_g).toFixed(0)}C</span>}
                      {recipe.carbs_g !== null && recipe.fat_g !== null && ' · '}
                      {recipe.fat_g !== null && <span>{Number(recipe.fat_g).toFixed(0)}F</span>}
                      <span style={{ color: TEXT_MUTED }}> per serving</span>
                    </div>
                  )}

                  {(recipe.cuisine || recipe.protein_type) && (
                    <div className="flex gap-2">
                      {recipe.cuisine && (
                        <span
                          className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{
                            background: 'rgba(201,160,60,0.12)',
                            color: TEXT_MID,
                          }}
                        >
                          {recipe.cuisine}
                        </span>
                      )}
                      {recipe.protein_type && (
                        <span
                          className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{
                            background: 'rgba(201,160,60,0.12)',
                            color: TEXT_MID,
                          }}
                        >
                          {recipe.protein_type}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
