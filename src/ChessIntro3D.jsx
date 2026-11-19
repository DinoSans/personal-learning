
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import './ChessIntro3D.css'

const smooth = (a, b, t) => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

const silver = '#dff5ff'
const dark = '#10243e'
const blue = '#16aaff'

function Metal({ color = silver, glow = blue, intensity = 0.22 }) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.9}
      roughness={0.17}
      emissive={glow}
      emissiveIntensity={intensity}
    />
  )
}


function Piece({ type = 'pawn', color = silver, position = [0, 0.08, 0], scale = 1, animate }) {
  const group = useRef()
  const darkPiece = color === dark
  const glow = darkPiece ? '#087cff' : '#35c8ff'
    const maps = useTexture({
  map: '/textures/chess/Metal010_1K_Color.jpg',
  normalMap: '/textures/chess/Metal010_1K_NormalGL.jpg',
  roughnessMap: '/textures/chess/Metal010_1K_Roughness.jpg',
  metalnessMap: '/textures/chess/Metal010_1K_Metalness.jpg',
})

maps.map.colorSpace = THREE.SRGBColorSpace

maps.map.wrapS = THREE.RepeatWrapping
maps.map.wrapT = THREE.RepeatWrapping
maps.normalMap.wrapS = THREE.RepeatWrapping
maps.normalMap.wrapT = THREE.RepeatWrapping

maps.map.repeat.set(2, 2)
maps.normalMap.repeat.set(2, 2)
maps.roughnessMap.repeat.set(2, 2)
maps.metalnessMap.repeat.set(2, 2)
  const armor = darkPiece ? '#07172c' : '#263d55'
  const edge = darkPiece ? '#123c68' : '#a9eaff'

  useFrame(({ clock }, delta) => {
    if (!group.current) return

    const t = clock.elapsedTime
    const g = group.current
    const targetPosition = new THREE.Vector3(...position)
    const targetRotation = new THREE.Euler(0, 0, 0)

    if (animate === 'pawn') {
      const p = smooth(1.1, 4.2, t)
      targetPosition.x = THREE.MathUtils.lerp(-2.55, -0.25, p)
      targetPosition.y += Math.pow(Math.max(0, Math.sin(p * Math.PI * 5)), 1.5) * 0.2
      targetRotation.y = Math.sin(p * Math.PI * 5) * 0.12
    }

    if (animate === 'knight') {
      const p = smooth(4.1, 6.15, t)
      targetPosition.x = THREE.MathUtils.lerp(2.7, -0.15, p)
      targetPosition.z = THREE.MathUtils.lerp(0.5, 2.15, p)
      targetPosition.y += Math.sin(p * Math.PI) * 1.8
      targetRotation.z = -Math.sin(p * Math.PI) * 0.65
      targetRotation.y = -p * 0.45

      const impact = Math.exp(-Math.pow((t - 6.15) / 0.12, 2))
      targetPosition.y += impact * 0.22
      targetRotation.x += impact * 0.28
    }

    if (animate === 'bishop') {
      const p = smooth(7.1, 9.1, t)
      targetPosition.x = THREE.MathUtils.lerp(-2.8, 0.25, p)
      targetPosition.z = THREE.MathUtils.lerp(-1.8, -0.5, p)
      targetPosition.y += Math.sin(p * Math.PI) * 1.3
      targetRotation.z = -Math.sin(p * Math.PI) * 0.45
      targetRotation.y = p * 0.6
    }

    if (animate === 'king') {
      targetPosition.y += Math.sin(t * 2.2) * 0.045
      targetRotation.y = Math.sin(t * 0.65) * 0.12
    }

    if (!animate) {
      targetPosition.y += Math.sin(t * 1.4 + position[0]) * 0.025
      targetRotation.y = Math.sin(t * 0.5) * 0.035
    }

    const smoothing = 1 - Math.exp(-delta * 7)
    g.position.lerp(targetPosition, smoothing)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetRotation.x, 8, delta)
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRotation.y, 8, delta)
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, targetRotation.z, 8, delta)
  })

    const bodyMaterial = (
  <meshStandardMaterial
    color={darkPiece ? '#526b85' : '#9aafc4'}
    map={maps.map}
    normalMap={maps.normalMap}
    roughnessMap={maps.roughnessMap}
    metalnessMap={maps.metalnessMap}
    metalness={1}
    roughness={0.3}
    emissive={glow}
    emissiveIntensity={0.28}
  />
)

    const brightMaterial = (
    <meshStandardMaterial
      color={edge}
      metalness={1}
      roughness={0.14}
      emissive={glow}
      emissiveIntensity={0.9}
    />
  )

  return (
    <group ref={group} position={position} scale={scale}>
      {/* PREMIUM ARMORED BASE */}
      <mesh castShadow position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.32, 0.45, 0.17, 64]} />
        {bodyMaterial}
      </mesh>

      <mesh position={[0, 0.205, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.035, 64]} />
        {brightMaterial}
      </mesh>

      <mesh castShadow position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.23, 0.32, 0.18, 48]} />
        {bodyMaterial}
      </mesh>

      <mesh position={[0, 0.415, 0]}>
        <torusGeometry args={[0.245, 0.022, 12, 64]} />
        {brightMaterial}
      </mesh>

      {/* BASE ARMOR PANELS */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.13, 0.365]}>
              <boxGeometry args={[0.09, 0.105, 0.045]} />
              {brightMaterial}
            </mesh>
          </group>
        )
      })}

      {/* PAWN — RECON UNIT */}
      {type === 'pawn' && (
        <>
          <mesh castShadow position={[0, 0.68, 0]}>
            <cylinderGeometry args={[0.13, 0.22, 0.48, 32]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 0.91, 0]}>
            <torusGeometry args={[0.15, 0.025, 12, 40]} />
            {brightMaterial}
          </mesh>

          <mesh castShadow position={[0, 1.13, 0]}>
            <icosahedronGeometry args={[0.19, 2]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 1.13, 0.15]}>
            <sphereGeometry args={[0.055, 20, 20]} />
            <meshBasicMaterial color="#b9f4ff" />
          </mesh>

          <mesh position={[0, 1.13, 0]}>
            <torusGeometry args={[0.22, 0.014, 8, 48]} />
            {brightMaterial}
          </mesh>

          <mesh position={[0, 0.68, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.24, 32]} />
            <meshBasicMaterial color={glow} wireframe />
          </mesh>
        </>
      )}

      {/* KNIGHT — CYBER MECH */}
      {type === 'knight' && (
        <>
          {/* Mechanical neck */}
          <mesh castShadow position={[0, 0.82, 0]} rotation={[0, 0, -0.42]}>
            <capsuleGeometry args={[0.19, 0.52, 8, 20]} />
            {bodyMaterial}
          </mesh>

          {/* Horse head */}
          <mesh castShadow position={[0.05, 1.2, 0.02]} rotation={[0, 0, -0.35]}>
            <capsuleGeometry args={[0.16, 0.38, 8, 20]} />
            {brightMaterial}
          </mesh>

          {/* Snout */}
          <mesh castShadow position={[0.17, 1.12, 0.17]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.2, 0.14, 0.27]} />
            {bodyMaterial}
          </mesh>

          {/* Ears */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.11, 1.46, 0]}
              rotation={[0, 0, side * -0.2]}
            >
              <coneGeometry args={[0.075, 0.28, 5]} />
              {brightMaterial}
            </mesh>
          ))}

          {/* Glowing eyes */}
          <mesh position={[0.13, 1.25, 0.16]}>
            <sphereGeometry args={[0.045, 20, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          <mesh position={[0.13, 1.25, -0.16]}>
            <sphereGeometry args={[0.045, 20, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Mechanical mane */}
          {Array.from({ length: 5 }, (_, i) => (
            <mesh
              key={i}
              position={[-0.13, 1.42 - i * 0.12, -0.02]}
              rotation={[0, 0, -0.4]}
            >
              <boxGeometry args={[0.12, 0.2, 0.12]} />
              {brightMaterial}
            </mesh>
          ))}

          {/* Neck armor */}
          <mesh position={[-0.18, 0.83, 0.08]} rotation={[0, 0, -0.42]}>
            <boxGeometry args={[0.12, 0.48, 0.31]} />
            {bodyMaterial}
          </mesh>

          <pointLight position={[0, 1.2, 0.4]} color={glow} intensity={1.3} distance={2} />
        </>
      )}

      {/* BISHOP — PLASMA GUARD */}
      {type === 'bishop' && (
        <>
          <mesh castShadow position={[0, 0.88, 0]}>
            <latheGeometry args={[
              [
                new THREE.Vector2(0.23, 0),
                new THREE.Vector2(0.17, 0.18),
                new THREE.Vector2(0.11, 0.42),
                new THREE.Vector2(0.18, 0.62),
                new THREE.Vector2(0.22, 0.76),
                new THREE.Vector2(0.08, 0.9)
              ],
              48
            ]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 1.7, 0]}>
            <octahedronGeometry args={[0.16, 1]} />
            {brightMaterial}
          </mesh>

          <mesh position={[0, 1.34, 0]} rotation={[0, 0, 0.62]}>
            <boxGeometry args={[0.055, 0.48, 0.055]} />
            <meshBasicMaterial color="#d8faff" />
          </mesh>

          <mesh position={[0, 1.34, 0]} rotation={[0, 0, -0.62]}>
            <boxGeometry args={[0.025, 0.35, 0.025]} />
            <meshBasicMaterial color={glow} />
          </mesh>

          <mesh position={[0, 1.12, 0]}>
            <torusGeometry args={[0.2, 0.018, 8, 48]} />
            {brightMaterial}
          </mesh>
        </>
      )}

      {/* QUEEN — EMPRESS CORE */}
      {type === 'queen' && (
        <>
          <mesh castShadow position={[0, 0.9, 0]}>
            <latheGeometry args={[
              [
                new THREE.Vector2(0.24, 0),
                new THREE.Vector2(0.15, 0.22),
                new THREE.Vector2(0.11, 0.48),
                new THREE.Vector2(0.2, 0.72),
                new THREE.Vector2(0.25, 0.84)
              ],
              48
            ]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 1.75, 0]}>
            <icosahedronGeometry args={[0.2, 2]} />
            {brightMaterial}
          </mesh>

          {Array.from({ length: 8 }, (_, i) => {
            const angle = i * Math.PI / 4
            return (
              <group key={i} rotation={[0, angle, 0]}>
                <mesh position={[0, 1.69, 0.23]}>
                  <coneGeometry args={[0.075, 0.3, 5]} />
                  {brightMaterial}
                </mesh>
              </group>
            )
          })}

          <mesh position={[0, 1.47, 0]}>
            <torusGeometry args={[0.24, 0.025, 12, 48]} />
            {brightMaterial}
          </mesh>
        </>
      )}

      {/* KING — TITAN COMMANDER */}
      {type === 'king' && (
        <>
          <mesh castShadow position={[0, 0.96, 0]}>
            <latheGeometry args={[
              [
                new THREE.Vector2(0.27, 0),
                new THREE.Vector2(0.17, 0.2),
                new THREE.Vector2(0.13, 0.48),
                new THREE.Vector2(0.22, 0.73),
                new THREE.Vector2(0.28, 0.88)
              ],
              64
            ]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 1.84, 0]}>
            <icosahedronGeometry args={[0.23, 2]} />
            {brightMaterial}
          </mesh>

          {/* Crown cross */}
          <mesh position={[0, 2.18, 0]}>
            <boxGeometry args={[0.12, 0.55, 0.12]} />
            {brightMaterial}
          </mesh>

          <mesh position={[0, 2.25, 0]}>
            <boxGeometry args={[0.42, 0.12, 0.12]} />
            {brightMaterial}
          </mesh>

          {/* Shoulder armor */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.24, 1.43, 0]}
              rotation={[0, 0, side * -0.25]}
            >
              <boxGeometry args={[0.2, 0.3, 0.34]} />
              {bodyMaterial}
            </mesh>
          ))}

          <mesh position={[0, 1.55, 0]}>
            <torusGeometry args={[0.27, 0.025, 12, 48]} />
            {brightMaterial}
          </mesh>

          <pointLight position={[0, 1.8, 0]} color={glow} intensity={2} distance={3} />
        </>
      )}

      {/* ROOK — SIEGE FORTRESS */}
      {type === 'rook' && (
        <>
          <mesh castShadow position={[0, 0.86, 0]}>
            <cylinderGeometry args={[0.25, 0.34, 0.76, 8]} />
            {bodyMaterial}
          </mesh>

          <mesh position={[0, 1.27, 0]}>
            <cylinderGeometry args={[0.34, 0.25, 0.15, 8]} />
            {brightMaterial}
          </mesh>

          {Array.from({ length: 8 }, (_, i) => {
            const angle = i * Math.PI / 4
            return (
              <group key={i} rotation={[0, angle, 0]}>
                <mesh position={[0, 1.43, 0.24]}>
                  <boxGeometry args={[0.14, 0.24, 0.16]} />
                  {brightMaterial}
                </mesh>
              </group>
            )
          })}

          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.42, 8]} />
            <meshBasicMaterial color={glow} wireframe />
          </mesh>

          <mesh position={[0, 1.04, 0]}>
            <torusGeometry args={[0.28, 0.025, 8, 40]} />
            {brightMaterial}
          </mesh>
        </>
      )}

      <pointLight position={[0, 0.9, 0]} color={glow} intensity={0.8} distance={2.8} />
    </group>
  )
}


function ChessBoard() {
  const tiles = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const light = (row + col) % 2 === 0

      tiles.push(
        <mesh
          key={`${row}-${col}`}
          receiveShadow
          position={[col - 3.5, 0, row - 3.5]}
        >
          <boxGeometry args={[0.985, 0.13, 0.985]} />
          <meshStandardMaterial
            color={light ? '#9dcce4' : '#081a36'}
            metalness={0.78}
            roughness={0.22}
            emissive={light ? '#125078' : '#031b46'}
            emissiveIntensity={0.4}
          />
        </mesh>
      )
    }
  }

  return (
    <group>
      {tiles}

      <mesh receiveShadow position={[0, -0.17, 0]}>
        <boxGeometry args={[8.35, 0.24, 8.35]} />
        <meshStandardMaterial color="#061326" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]}>
        <ringGeometry args={[5.8, 5.88, 96]} />
        <meshBasicMaterial color="#138bff" transparent opacity={0.65} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <ringGeometry args={[6.15, 6.19, 96]} />
        <meshBasicMaterial color="#16cfff" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

function EnergyParticles() {
  const ref = useRef()

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.025
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.15) * 0.05
    }
  })

  return (
    <group ref={ref}>
      <points>
        <sphereGeometry args={[11, 70, 45]} />
        <pointsMaterial
          color="#4dbfff"
          size={0.025}
          transparent
          opacity={0.5}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

const cameraShots = [
  { t: 0, pos: [0, 3.8, 13], target: [0, 0, 0] },
  { t: 2.5, pos: [-5.5, 2.1, 6], target: [-1.2, 0.4, 1.2] },
  { t: 5, pos: [4.8, 2.8, 5.2], target: [0, 0.5, 1.2] },
  { t: 7.5, pos: [0, 10, 1.2], target: [0, 0, 0] },
  { t: 10, pos: [5.5, 3.2, -5.5], target: [0, 0.6, -0.5] },
  { t: 13, pos: [-4.5, 2.5, -5.8], target: [0, 0.7, -1.5] },
  { t: 16, pos: [0, 3.5, 7.5], target: [0, 0.7, 0] },
  { t: 18, pos: [0, 2.7, 11], target: [0, 0.8, 0] }
]

function CinematicCamera() {
  const camera = useRef()
  const target = useRef(new THREE.Vector3())

  useFrame(({ clock }) => {
    if (!camera.current) return

    const t = Math.min(clock.elapsedTime, 18)

    let a = cameraShots[0]
    let b = cameraShots[cameraShots.length - 1]

    for (let i = 0; i < cameraShots.length - 1; i++) {
      if (t >= cameraShots[i].t && t <= cameraShots[i + 1].t) {
        a = cameraShots[i]
        b = cameraShots[i + 1]
        break
      }
    }

    const p = smooth(a.t, b.t, t)
    const pos = new THREE.Vector3(...a.pos).lerp(new THREE.Vector3(...b.pos), p)
    const look = new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), p)

    camera.current.position.copy(pos)
    target.current.copy(look)
    camera.current.lookAt(target.current)
  })

  return (
    <perspectiveCamera
      ref={camera}
      makeDefault
      position={[0, 3.8, 13]}
      fov={43}
      near={0.1}
      far={100}
    />
  )
}

function Scene() {
  return (
    <>
      <CinematicCamera />

      <color attach="background" args={['#020712']} />
      <fog attach="fog" args={['#020712', 13, 28]} />

      <ambientLight intensity={0.55} />

      <directionalLight
        position={[4, 9, 5]}
        intensity={2.4}
        color="#d5f2ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <pointLight position={[-5, 4, -3]} intensity={45} color="#087cff" distance={18} />
      <pointLight position={[5, 3, 4]} intensity={32} color="#19c9ff" distance={16} />
      <pointLight position={[0, 5, 0]} intensity={12} color="#146eff" distance={12} />

      <Stars radius={45} depth={35} count={1400} factor={3} saturation={0.6} fade speed={0.5} />

      <ChessBoard />
      <EnergyParticles />

      <Piece type="pawn" position={[-2.55, 0.08, 2.5]} animate="pawn" />
      <Piece type="knight" color={dark} position={[2.7, 0.08, 0.5]} animate="knight" scale={1.08} />
      <Piece type="bishop" position={[-2.8, 0.08, -1.8]} animate="bishop" />
      <Piece type="queen" position={[2.1, 0.08, -2.2]} scale={0.95} />
      <Piece type="rook" color={dark} position={[-3.1, 0.08, -2.5]} />
      <Piece type="king" position={[0.3, 0.08, -2.4]} scale={1.15} animate="king" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#020712" metalness={0.3} roughness={0.8} />
      </mesh>
    </>
  )
}

export default function ChessIntro3D() {
  return (
    <div
      className="chess3d-overlay"
      role="presentation"
      aria-label="ITB Quest cinematic chess intro"
    >
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 3.8, 13], fov: 43 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
      </Canvas>

      <div className="chess3d-vignette" />

      <div className="chess3d-topline">
        <span>ITB QUEST · NEURAL SYSTEM</span>
        <span>CHESS PROTOCOL ACTIVATED</span>
      </div>

      <div className="chess3d-caption">
        <span>A SINGLE MOVE CHANGES EVERYTHING.</span>
        <small>STRATEGY · PRECISION · INTELLIGENCE</small>
      </div>

      <div className="chess3d-title">
        <small>ITB QUEST · GAME MODULE 01</small>
        <h1>CHESS<span>.</span></h1>
        <p>THE BATTLE OF STRATEGY BEGINS</p>
        <i />
        <small>INITIALIZING CHESS ARENA...</small>
      </div>

      <div className="chess3d-coordinates">
        64 SQUARES <b>·</b> INFINITE POSSIBILITIES
      </div>
    </div>
  )
}
