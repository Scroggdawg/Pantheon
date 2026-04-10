'use client'

export default function MarbleBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: 'url("/marble-bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transform: 'scaleY(-1)',
      }}
    />
  )
}
