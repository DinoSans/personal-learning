
import { useEffect, useRef, useState } from 'react'
import './ChessIntro.css'

const pieces = [
  { name: 'KING', symbol: '♚' },
  { name: 'QUEEN', symbol: '♛' },
  { name: 'ROOK', symbol: '♜' },
  { name: 'BISHOP', symbol: '♝' },
  { name: 'KNIGHT', symbol: '♞' },
  { name: 'PAWN', symbol: '♟' },
]

export default function ChessIntro({ onComplete }) {
  const [active, setActive] = useState(0)
  const [phase, setPhase] = useState('idle')
  const spinInterval = useRef(null)
  const stopTimeout = useRef(null)
  const finishTimeout = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(spinInterval.current)
      clearTimeout(stopTimeout.current)
      clearTimeout(finishTimeout.current)
    }
  }, [])

  const startSpin = () => {
    if (phase !== 'idle') return

    setPhase('spinning')

    spinInterval.current = setInterval(() => {
      setActive(Math.floor(Math.random() * pieces.length))
    }, 110)

    stopTimeout.current = setTimeout(() => {
      clearInterval(spinInterval.current)
      setActive(Math.floor(Math.random() * pieces.length))
      setPhase('selected')
    }, 2600)
  }

  const confirmChoice = () => {
    if (phase !== 'selected') return

    setPhase('reveal')

    finishTimeout.current = setTimeout(() => {
      onComplete?.()
    }, 2400)
  }

  return (
    <div className={`chess-intro ${phase === 'reveal' ? 'revealing' : ''}`}>

      <div className="chess-intro-bg" />
      <div className="chess-intro-grid" />

      <div className="chess-intro-content">

        {phase !== 'reveal' ? (
          <>
            <div className="chess-intro-eyebrow">
              ITB QUEST / NEURAL ARENA
            </div>

            <h1 className="chess-intro-title">
              SELECT YOUR <span>CHAMPION</span>
            </h1>

            <p className="chess-intro-subtitle">
              Every piece has a purpose.
            </p>

            <div className={`chess-piece-list ${phase}`}>
              {pieces.map((piece, index) => (
                <div
                  key={piece.name}
                  className={`chess-piece-card ${
                    active === index ? 'active' : ''
                  }`}
                >
                  <div className="chess-piece-glow" />

                  <div className="chess-piece-symbol">
                    {piece.symbol}
                  </div>

                  <div className="chess-piece-name">
                    {piece.name}
                  </div>
                </div>
              ))}
            </div>

            <div className="chess-intro-action">
              {phase === 'idle' && (
                <button onClick={startSpin}>
                  CHOOSE <span>↗</span>
                </button>
              )}

              {phase === 'spinning' && (
                <div className="chess-scanning">
                  SCANNING CHESS PIECES...
                </div>
              )}

              {phase === 'selected' && (
                <>
                  <div className="chess-selected-label">
                    SELECTED: {pieces[active].name}
                  </div>

                  <button onClick={confirmChoice}>
                    CONFIRM CHOICE <span>↗</span>
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="chess-reveal">
  <h1>CHESS</h1>
</div>
        )}

      </div>

      <div className="chess-intro-footer">
        <span>ITB QUEST</span>
        <span>STRATEGY IS EVERYTHING</span>
      </div>

    </div>
  )
}
