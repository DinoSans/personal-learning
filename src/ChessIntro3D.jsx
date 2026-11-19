import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import './ChessIntro3D.css'

function Piece({ type = 'pawn', color = '#dff7ff', position = [0, 0, 0], scale = 1, animate }) {
  const group = useRef()
  const glow = color === '#dff7ff' ? '#45bfff' : '#126bff'

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    if (animate === 'pawn') {
      group.current.position.x = THREE.MathUtils.lerp(-2.55, -0.25, Math.min(1, Math.max(0, (t - 1) / 3)))
      group.current.position.y = 0.12 + Math.abs(Math.sin(t * 3)) * 0.13
    } else if (animate === 'knight') {
      const p = Math.max(0, Math.min(1, (t - 4) / 2))
      group.current.position.x = THREE.MathUtils.lerp(2.7, 0.2, p)
      group.current.position.y = Math.sin(p * Math.PI) * 1.2 + 0.12
      group.current.rotation.z = Math.sin(p * Math.PI) * -0.35
    } else if (animate === 'bishop') {
      const p = Math.max(0, Math.min(1, (t - 7) / 1.5))
      group.current.position.x = THREE.MathUtils.lerp(-2.8, 0.4, p)
      group.current.position.y = Math.sin(p * Math.PI) * 0.7 + 0.12
    } else {
      group.current.position.y = 0.12 + Math.sin(t * 1.5 + position[0]) * 0.035
    }
  })

  return (
    <group ref={group} position={position} scale={scale}>
      <mesh castShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.34, 0.4, 0.2, 32]} />
        <meshStandardMaterial color={color} metalness={0.82} roughness={0.22} emissive={glow} emissiveIntensity={0.32} />
      </mesh>
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={type === 'rook' ? [0.23, 0.29, 0.28, 8] : [0.2, 0.29, 0.32, 32]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.2} emissive={glow} emissiveIntensity={0.22} />
      </mesh>
      {type === 'pawn' && <mesh castShadow position={[0, 0.62, 0]}><sphereGeometry args={[0.2, 24, 24]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.18} emissive={glow} emissiveIntensity={0.3} /></mesh>}
      {type === 'knight' && <>
        <mesh castShadow position={[0, 0.68, 0]} rotation={[0, 0, -0.25]}><coneGeometry args={[0.25, 0.65, 5]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive={glow} emissiveIntensity={0.4} /></mesh>
        <mesh position={[0.08, 0.94, 0.08]}><sphereGeometry args={[0.09, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
      </>}
      {type === 'bishop' && <>
        <mesh castShadow position={[0, 0.75, 0]}><coneGeometry args={[0.22, 0.62, 24]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive={glow} emissiveIntensity={0.35} /></mesh>
        <mesh position={[0, 1.1, 0]}><sphereGeometry args={[0.09, 20, 20]} /><meshBasicMaterial color="#ffffff" /></mesh>
      </>}
      {type === 'queen' && <>
        <mesh castShadow position={[0, 0.76, 0]}><cylinderGeometry args={[0.13, 0.25, 0.55, 24]} /><meshStandardMaterial color={color} metalness={0.85} roughness={0.18} emissive={glow} emissiveIntensity={0.3} /></mesh>
        <mesh castShadow position={[0, 1.1, 0]}><sphereGeometry args={[0.22, 24, 24]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.15} emissive={glow} emissiveIntensity={0.4} /></mesh>
      </>}
      {type === 'king' && <>
        <mesh castShadow position={[0, 0.78, 0]}><cylinderGeometry args={[0.14, 0.25, 0.65, 24]} /><meshStandardMaterial color={color} metalness={0.85} roughness={0.18} emissive={glow} emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, 1.25, 0]}><boxGeometry args={[0.12, 0.48, 0.12]} /><meshStandardMaterial color={color} emissive={glow} emissiveIntensity={0.8} /></mesh>
        <mesh position={[0, 1.34, 0]}><boxGeometry args={[0.36, 0.12, 0.12]} /><meshStandardMaterial color={color} emissive={glow} emissiveIntensity={0.8} /></mesh>
      </>}
      {type === 'rook' && <mesh castShadow position={[0, 0.72, 0]}><cylinderGeometry args={[0.22, 0.25, 0.5, 8]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive={glow} emissiveIntensity={0.3} /></mesh>}
      <pointLight position={[0, 0.5, 0]} color={glow} intensity={0.5} distance={2} />
    </group>
  )
}

function ChessBoard() {
  const tiles = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const light = (row + col) % 2 === 0
      tiles.push(
        <mesh key={`${row}-${col}`} receiveShadow position={[col - 3.5, 0, row - 3.5]}>
          <boxGeometry args={[0.99, 0.12, 0.99]} />
          <meshStandardMaterial color={light ? '#b7d8e9' : '#102b4b'} metalness={0.55} roughness={0.3} emissive={light ? '#1b5277' : '#031b46'} emissiveIntensity={0.28} />
        </mesh>
      )
    }
  }
  return <group>{tiles}<mesh position={[0, -0.18, 0]} receiveShadow><boxGeometry args={[8.25, 0.25, 8.25]} /><meshStandardMaterial color="#071326" metalness={0.8} roughness={0.25} /></mesh></group>
}

function Scene() {
  const camera = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!camera.current) return
    const targetZ = t < 6 ? 11 : t < 11 ? 9 : 10
    camera.current.position.x = Math.sin(t * 0.18) * (t < 6 ? 1.1 : 0.45)
    camera.current.position.y = THREE.MathUtils.lerp(camera.current.position.y, t < 6 ? 5.2 : 9.2, 0.018)
    camera.current.position.z = THREE.MathUtils.lerp(camera.current.position.z, targetZ, 0.018)
    camera.current.lookAt(0, 0, 0)
  })

  return (
    <>
      <perspectiveCamera ref={camera} makeDefault position={[0, 5.2, 11]} fov={42} />
      <color attach="background" args={['#020712']} />
      <fog attach="fog" args={['#020712', 12, 25]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 9, 5]} intensity={2.1} color="#b9eaff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-5, 4, -3]} intensity={35} color="#087cff" distance={16} />
      <pointLight position={[5, 3, 4]} intensity={24} color="#19c9ff" distance={13} />
      <Stars radius={45} depth={30} count={900} factor={3} saturation={0.4} fade speed={0.45} />
      <ChessBoard />
      <Piece type="pawn" position={[-2.55, 0.12, 2.5]} animate="pawn" />
      <Piece type="knight" color="#172b4b" position={[2.7, 0.12, 0.5]} animate="knight" scale={1.08} />
      <Piece type="bishop" position={[-2.8, 0.12, -1.8]} animate="bishop" />
      <Piece type="queen" position={[2.1, 0.12, -2.2]} scale={0.95} />
      <Piece type="rook" color="#172b4b" position={[-3.1, 0.12, -2.5]} />
      <Piece type="king" position={[0.3, 0.12, -2.4]} scale={1.18} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#020712" metalness={0.2} roughness={0.8} />
      </mesh>
    </>
  )
}

export default function ChessIntro3D() {
  return (
    <div className="chess3d-overlay" role="presentation" aria-label="ITB Quest 3D chess cinematic intro">
      <Canvas shadows dpr={[1, 1.7]} gl={{ antialias: true, alpha: false }}>
        <Scene />
      </Canvas>
      <div className="chess3d-vignette" />
      <div className="chess3d-topline"><span>ITB QUEST · NEURAL SYSTEM</span><span>CHESS PROTOCOL ACTIVATED</span></div>
      <div className="chess3d-caption"><span>A SINGLE MOVE CHANGES EVERYTHING.</span><small>STRATEGY · PRECISION · INTELLIGENCE</small></div>
      <div className="chess3d-title"><small>ITB QUEST · GAME MODULE 01</small><h1>CHESS<span>.</span></h1><p>THE BATTLE OF STRATEGY BEGINS</p><i /><small>INITIALIZING CHESS ARENA...</small></div>
      <div className="chess3d-coordinates">64 SQUARES <b>·</b> INFINITE POSSIBILITIES</div>
    </div>
  )
}
