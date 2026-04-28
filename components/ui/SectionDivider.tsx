const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const GOLD_BRIGHT = '#e8c048'

export default function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div
        className="flex-1 h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, ${GOLD_BRIGHT}, ${GOLD_LIGHT}, transparent)`,
        }}
      />
      <span
        className="text-[11px] uppercase tracking-[0.2em] font-medium"
        style={{ color: GOLD }}
      >
        {'\u2726'} {label} {'\u2726'}
      </span>
      <div
        className="flex-1 h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, ${GOLD_BRIGHT}, ${GOLD_LIGHT}, transparent)`,
        }}
      />
    </div>
  )
}
