'use client'

interface GlassPanelProps {
  children: React.ReactNode
  className?: string
}

export default function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div
      className={`relative rounded-[20px] overflow-hidden ${className}`}
      style={{
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%)',
        backdropFilter: 'blur(0.1px)',
        WebkitBackdropFilter: 'blur(0.1px)',
        boxShadow:
          '0 12px 40px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {/* Corner blur accents */}
      <div
        className="absolute bottom-0 left-0 w-[50px] h-[50px] pointer-events-none z-0"
        style={{
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          background: 'radial-gradient(ellipse at bottom left, rgba(255,255,255,0.15) 0%, transparent 70%)',
          maskImage: 'radial-gradient(ellipse at bottom left, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at bottom left, black 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute top-0 right-0 w-[50px] h-[50px] pointer-events-none z-0"
        style={{
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          background: 'radial-gradient(ellipse at top right, rgba(255,255,255,0.18) 0%, transparent 70%)',
          maskImage: 'radial-gradient(ellipse at top right, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top right, black 0%, transparent 70%)',
        }}
      />
      {/* Edge blur bands */}
      <div className="absolute inset-x-0 top-0 h-[18px] pointer-events-none z-0" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[18px] pointer-events-none z-0" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', maskImage: 'linear-gradient(to top, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)' }} />
      <div className="absolute inset-y-0 left-0 w-[18px] pointer-events-none z-0" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', maskImage: 'linear-gradient(to right, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)' }} />
      <div className="absolute inset-y-0 right-0 w-[18px] pointer-events-none z-0" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', maskImage: 'linear-gradient(to left, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)' }} />
      {/* Top/left highlight edges */}
      <div className="absolute inset-x-0 top-0 h-[6px] pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 50%, transparent 100%)', borderRadius: '20px 20px 0 0' }} />
      <div className="absolute inset-y-0 left-0 w-[4px] pointer-events-none z-20" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }} />
      {/* Bottom/right shadow edges */}
      <div className="absolute inset-x-0 bottom-0 h-[6px] pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.12) 100%)', borderRadius: '0 0 20px 20px' }} />
      <div className="absolute inset-y-0 right-0 w-[4px] pointer-events-none z-20" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.08) 100%)' }} />
      {/* Corner specular highlights */}
      <div className="absolute top-[2px] left-[2px] w-[24px] h-[24px] pointer-events-none z-20" style={{ background: 'radial-gradient(ellipse at top left, rgba(255,255,255,0.45) 0%, transparent 70%)' }} />
      <div className="absolute inset-x-[5px] top-[5px] h-[10px] rounded-t-[14px] pointer-events-none z-20" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)' }} />
      <div className="absolute bottom-[2px] right-[2px] w-[20px] h-[20px] pointer-events-none z-20" style={{ background: 'radial-gradient(ellipse at bottom right, rgba(0,0,0,0.08) 0%, transparent 70%)' }} />
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
