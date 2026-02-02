import { Metronome } from 'ldrs/react'
import 'ldrs/react/Metronome.css'

interface SpinnerProps {
  className?: string
  size?: number | string
  color?: string
  speed?: number | string
}

function Spinner({ size = 16, color, speed = 1.6 }: SpinnerProps) {
  // Use CSS variable for color if not specified
  const spinnerColor = color ?? 'hsl(var(--muted-foreground))'

  return (
    <Metronome
      size={String(size)}
      speed={String(speed)}
      color={spinnerColor}
    />
  )
}

export { Spinner }
