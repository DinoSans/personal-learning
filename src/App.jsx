
import { useState, useRef, useEffect } from 'react'
import { Chess } from 'chess.js'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './App.css'

const chessBoardRows = [
  "rnbqkbnr",
  "pppppppp",
  "........",
  "........",
  "........",
  "........",
  "PPPPPPPP",
  "RNBQKBNR",
]

const chessPieces = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
}

const DB_NAME = 'itb-quest-db'
const STORE_NAME = 'progress'

function openProgressDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveLocalProgress(userId, progress) {
  const db = await openProgressDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(userId)

    request.onsuccess = () => {
      const previous = request.result

      const sameData = previous &&
        JSON.stringify({
          xp: previous.xp,
          level: previous.level,
          streak: previous.streak,
          completed_lessons: previous.completed_lessons,
          completed_missions: previous.completed_missions,
          quiz_results: previous.quiz_results
        }) === JSON.stringify({
          xp: progress.xp,
          level: progress.level,
          streak: progress.streak,
          completed_lessons: progress.completed_lessons,
          completed_missions: progress.completed_missions,
          quiz_results: progress.quiz_results
        })

      const progressToSave = {
        ...progress,
        updated_at: sameData && previous.updated_at
          ? previous.updated_at
          : progress.updated_at || new Date().toISOString()
      }

      store.put(progressToSave, userId)
    }

    transaction.oncomplete = () => {
      db.close()
      resolve(true)
    }

    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

async function loadLocalProgress(userId) {
  const db = await openProgressDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(userId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}
async function syncProgressToServer(progress) {
  const progressWithTimestamp = {
    ...progress,
    updated_at: progress.updated_at || new Date().toISOString()
  }

  const response = await fetch('/api/progress', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(progressWithTimestamp)
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Gagal sinkronisasi progress.')
  }

  return data
}

async function loadProgressFromServer() {
  const response = await fetch('/api/progress', {
    method: 'GET',
    credentials: 'same-origin'
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Gagal mengambil progress server.')
  }

  const serverProgress = data.progress

  return {
    xp: Number(serverProgress.xp) || 0,
    level: Number(serverProgress.level) || 1,
    streak: Number(serverProgress.streak) || 0,
    completed_lessons:
      JSON.parse(serverProgress.completed_lessons || '[]'),
    completed_missions:
      JSON.parse(serverProgress.completed_missions || '[]'),
    quiz_results:
      JSON.parse(serverProgress.quiz_results || '[]'),
    updated_at: serverProgress.updated_at || null
  }
}

function normalizeLatex(text = '') {
  return text
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, f) => `$$\n${f}\n$$`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, f) => `$${f}$`)
    .replace(/(?<!\\)\[\s*([^\[\]\n]*\\[a-zA-Z]+[^\[\]\n]*)\s*\](?!\()/g,
      (_, f) => `$$${f}$$`)
    .replace(/(?<!\\)\(([^()\n]*\\[a-zA-Z]+[^()\n]*)\)/g,
      (_, f) => `$${f}$`);
}


function CustomChessPiece({ piece, color }) {
  const isWhite = color === "white"
  const glowId = `piece-glow-${piece}-${color}`

  const common = {
  fill: isWhite ? "#d9eaf5" : "#244d72",
  stroke: isWhite ? "#8ac9e3" : "#5c9acb",
  strokeWidth: 2,
  strokeLinejoin: "round",
}

  return (
    <svg
      className={`custom-chess-piece ${isWhite ? "piece-white" : "piece-black"}`}
      viewBox="0 0 100 120"
      aria-label={`${piece} ${color}`}
    >
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g {...common} filter={`url(#${glowId})`}>

        {/* KING - RAJA */}
        {piece === "k" && (
          <>
            <path d="M50 8 V29 M39 18 H61" strokeWidth="5" fill="none" />
            <path d="M28 34 L34 23 L50 31 L66 23 L72 34 L67 58 H33 Z" />
            <path d="M37 39 L50 48 L63 39 L59 62 H41 Z" />
            <path d="M34 64 H66 L73 87 H27 Z" />
            <path d="M21 89 H79 L85 101 H15 Z" />
            <path d="M12 104 H88 V111 H12 Z" />
          </>
        )}

        {/* QUEEN - RATU */}
        {piece === "q" && (
          <>
            <path d="M50 13 L42 34 L24 21 L29 45 L14 34 L25 62 H75 L86 34 L71 45 L76 21 L58 34 Z" />
            <path d="M35 43 L50 30 L65 43 L61 65 H39 Z" />
            <path d="M29 68 H71 L77 88 H23 Z" />
            <path d="M19 90 H81 L87 102 H13 Z" />
            <path d="M10 105 H90 V112 H10 Z" />
            <circle cx="24" cy="21" r="4" />
            <circle cx="50" cy="13" r="4" />
            <circle cx="76" cy="21" r="4" />
          </>
        )}

        {/* ROOK - BENTENG */}
        {piece === "r" && (
          <>
            <path d="M24 17 H39 V29 H46 V17 H60 V29 H68 V17 H82 V43 H76 L72 83 H28 L24 43 H18 V17 Z" />
            <path d="M31 45 H69 L65 79 H35 Z" />
            <path d="M26 84 H74 L81 100 H19 Z" />
            <path d="M12 103 H88 V112 H12 Z" />
            <path d="M39 49 V74 M50 49 V74 M61 49 V74" fill="none" />
          </>
        )}

        {/* BISHOP - GAJAH */}
        {piece === "b" && (
          <>
            <path d="M50 10 L72 39 L66 62 H34 L28 39 Z" />
            <path d="M50 10 L50 61" fill="none" />
            <path d="M39 38 L50 26 L61 38" fill="none" />
            <path d="M34 65 H66 L75 87 H25 Z" />
            <path d="M20 90 H80 L86 102 H14 Z" />
            <path d="M10 105 H90 V112 H10 Z" />
          </>
        )}

        {/* KNIGHT - KUDA */}
        {piece === "n" && (
          <>
            <path d="M27 83 L23 61 L31 40 L28 23 L44 34 L54 20 L72 35 L81 61 L70 83 Z" />
            <path d="M44 34 L55 49 L75 54 L67 67 H39 L31 54 Z" />
            <path d="M53 20 L58 9 L69 28" fill="none" />
            <path d="M65 43 L72 45" strokeWidth="4" />
            <circle cx="62" cy="37" r="3" fill={isWhite ? "#ffffff" : "#55dfff"} />
            <path d="M26 86 H74 L82 101 H18 Z" />
            <path d="M11 104 H89 V112 H11 Z" />
          </>
        )}

        {/* PAWN - PION */}
        {piece === "p" && (
          <>
            <circle cx="50" cy="29" r="15" />
            <path d="M38 45 L62 45 L69 76 H31 Z" />
            <path d="M31 79 H69 L77 98 H23 Z" />
            <path d="M13 102 H87 V112 H13 Z" />
            <path d="M43 57 H57" fill="none" />
          </>
        )}
      </g>

      <path
        d="M35 72 H65"
        stroke={isWhite ? "#ffffff" : "#54c9ff"}
        strokeWidth="2"
        opacity=".8"
      />
    </svg>
  )
}


function App() {
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [adminUsers, setAdminUsers] = useState([])
const [adminLoading, setAdminLoading] = useState(false)
const [adminError, setAdminError] = useState('')
  const [progress, setProgress] = useState({
  xp: 0,
  level: 1,
  streak: 0,
  completed_lessons: [],
  completed_missions: [],
  quiz_results: []
})

const [progressLoading, setProgressLoading] = useState(true)
const [syncStatus, setSyncStatus] = useState('local')
const [progressLoadedFor, setProgressLoadedFor] = useState(null)
useEffect(() => {
  let cancelled = false

  async function initializeProgress() {
    if (!user?.id) {
      setProgressLoading(false)
      return
    }

    setProgressLoading(true)
    setProgressLoadedFor(null)

    try {
      // 1. Ambil progress dari IndexedDB
      const localProgress = await loadLocalProgress(user.id)

      if (cancelled) return

      let selectedProgress = localProgress || {
        xp: 0,
        level: 1,
        streak: 0,
        completed_lessons: [],
        completed_missions: [],
        quiz_results: [],
        updated_at: null
      }

      // 2. Coba ambil progress dari server
      try {
        const serverProgress = await loadProgressFromServer()

        if (cancelled) return

        const localTime = localProgress?.updated_at
          ? new Date(localProgress.updated_at).getTime()
          : 0

        const serverTime = serverProgress.updated_at
          ? new Date(serverProgress.updated_at).getTime()
          : 0

        // 3. Pilih data yang lebih baru
        if (serverTime > localTime) {
          selectedProgress = serverProgress
        } else if (
          localProgress &&
          localTime >= serverTime
        ) {
          selectedProgress = localProgress

          // Upload progress lokal jika lebih baru
          // atau server belum memiliki data tersimpan.
          if (localTime > serverTime || !serverTime) {
            const result = await syncProgressToServer(
              selectedProgress
            )

            selectedProgress = {
              ...selectedProgress,
              updated_at: result.updated_at ||
                selectedProgress.updated_at
            }
          }
        } else {
          selectedProgress = serverProgress
        }

        setSyncStatus('synced')

      } catch (syncError) {
        console.warn(
          'Server tidak tersedia, menggunakan progress lokal:',
          syncError
        )

        setSyncStatus('local')
      }

      if (cancelled) return

      // 4. Terapkan progress terpilih
      setProgress(selectedProgress)

      // 5. Simpan hasil pilihan ke IndexedDB
      await saveLocalProgress(user.id, selectedProgress)

      if (!cancelled) {
        setProgressLoadedFor(user.id)
      }

    } catch (error) {
      console.error('Gagal membaca progress:', error)

      if (!cancelled) {
        setProgressLoadedFor(user.id)
      }

    } finally {
      if (!cancelled) {
        setProgressLoading(false)
      }
    }
  }

  initializeProgress()

  return () => {
    cancelled = true
  }
}, [user?.id])
useEffect(() => {
  if (
  !user?.id ||
  progressLoading ||
  progressLoadedFor !== user.id
) return

  async function saveProgress() {
    try {
      await saveLocalProgress(user.id, progress)
      setSyncStatus('local')
    } catch (error) {
      console.error('Gagal menyimpan progress:', error)
    }
  }

  saveProgress()
}, [progress, progressLoading, progressLoadedFor, user?.id])
// AUTHENTICATION STATES
const [authMode, setAuthMode] = useState('login')
const [authEmail, setAuthEmail] = useState('')
const [authPassword, setAuthPassword] = useState('')
const [showPassword, setShowPassword] = useState(false)
const [authLoading, setAuthLoading] = useState(false)
const [authError, setAuthError] = useState('')

// AUTO SYNC WHEN INTERNET RETURNS
useEffect(() => {
  async function handleOnline() {
    if (!user?.id || progressLoading) return

    try {
      const result = await syncProgressToServer(progress)

      if (result.success) {
        setSyncStatus('synced')
      }
    } catch (error) {
      console.error('Gagal sinkronisasi progress:', error)
      setSyncStatus('local')
    }
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
  }
}, [user?.id, progress, progressLoading])
// CHECK LOGIN SESSION
useEffect(() => {
  let cancelled = false

  async function checkSession() {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'session'
        })
      })

      const data = await response.json()

      if (!cancelled && response.ok && data.success) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('Gagal memeriksa sesi:', error)
    } finally {
      if (!cancelled) {
        setAuthChecking(false)
      }
    }
  }

  checkSession()

  return () => {
    cancelled = true
  }
}, [])
async function handleAuth(event) {
  event.preventDefault()

  setAuthError('')
  setAuthLoading(true)

  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: authMode === 'register' ? 'register' : 'login',
        email: authEmail,
        password: authPassword
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Autentikasi gagal.')
    }

    const sessionResponse = await fetch('/api/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'same-origin',
  body: JSON.stringify({
    action: 'session'
  })
})

const sessionData = await sessionResponse.json()

if (!sessionResponse.ok || !sessionData.success) {
  throw new Error('Gagal mengambil data akun.')
}

setUser(sessionData.user)
setAuthPassword('')
  } catch (error) {
    setAuthError(error.message || 'Terjadi kesalahan.')
  } finally {
    setAuthLoading(false)
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'logout'
      })
    })
  } finally {
    setUser(null)
    setAuthEmail('')
    setAuthPassword('')
  }
}
  const [photo, setPhoto] = useState(null)
const [photoUploading, setPhotoUploading] = useState(false)

useEffect(() => {
  setPhoto(user?.profile_photo_url || null)
}, [user?.id, user?.profile_photo_url])
const [chatPhoto, setChatPhoto] = useState(null)
const chatFileRef = useRef(null)

function handleChatPhoto(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    alert('Gunakan gambar JPG, PNG, atau WEBP.')
    event.target.value = ''
    return
  }

  if (file.size > 3 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 3 MB.')
    event.target.value = ''
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    setChatPhoto(reader.result)
  }
  reader.onerror = () => {
  alert('Gagal membaca gambar. Coba pilih gambar lain.')
}

  reader.readAsDataURL(file)
  event.target.value = ''
}
const fetchAdminUsers = async () => {
  setAdminLoading(true)
  setAdminError('')

  try {
    const response = await fetch('/api/admin-users', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mengambil data pengguna.')
    }

    setAdminUsers(data.users || [])
  } catch (error) {
    setAdminError(error.message)
  } finally {
    setAdminLoading(false)
  }
}

const [showProfile, setShowProfile] = useState(false)
const [cameraOpen, setCameraOpen] = useState(false)
const [cameraError, setCameraError] = useState('')

const fileRef = useRef(null)
const videoRef = useRef(null)
const streamRef = useRef(null)
const canvasRef = useRef(null)

async function saveProfilePhoto(imageData) {
  const response = await fetch('/api/profile-photo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      image: imageData
    })
  })

  const data = await response.json()

  if (!response.ok || !data.success || !data.url) {
    throw new Error(data.error || 'Gagal menyimpan foto profil.')
  }

  setPhoto(data.url)

  setUser(previous => ({
    ...previous,
    profile_photo_url: data.url
  }))

  return data.url
}

async function uploadPhoto(event) {
  const file = event.target.files?.[0]

  if (!file) return

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ]

  if (!allowedTypes.includes(file.type)) {
    alert('Gunakan gambar JPG, PNG, atau WEBP.')
    event.target.value = ''
    return
  }

  if (file.size > 3 * 1024 * 1024) {
    alert('Ukuran foto maksimal 3 MB.')
    event.target.value = ''
    return
  }

  setPhotoUploading(true)

  const reader = new FileReader()

  reader.onload = async () => {
    try {
      await saveProfilePhoto(reader.result)
      setShowProfile(false)
    } catch (error) {
      alert(error.message)
    } finally {
      setPhotoUploading(false)
      event.target.value = ''
    }
  }

  reader.onerror = () => {
    alert('Gagal membaca foto.')
    setPhotoUploading(false)
    event.target.value = ''
  }

  reader.readAsDataURL(file)
}

function stopCamera() {
  streamRef.current?.getTracks().forEach(track => track.stop())
  streamRef.current = null
  setCameraOpen(false)
}

async function openCamera() {
  setCameraError('')
  setCameraOpen(true)
}

useEffect(() => {
  if (!cameraOpen) return

  let cancelled = false

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })

      if (cancelled) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      setCameraError('Kamera tidak dapat diakses. Periksa izin kamera perangkatmu.')
    }
  }

  startCamera()

  return () => {
    cancelled = true
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }
}, [cameraOpen])

async function takePhoto() {
  const video = videoRef.current
  const canvas = canvasRef.current

  if (!video || !canvas || !video.videoWidth) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const context = canvas.getContext('2d')

  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  context.drawImage(video, 0, 0)

  const imageData = canvas.toDataURL('image/jpeg', 0.75)

  setPhotoUploading(true)

  try {
    await saveProfilePhoto(imageData)
    stopCamera()
    setShowProfile(false)
  } catch (error) {
    alert(error.message)
  } finally {
    setPhotoUploading(false)
  }
}
  const [active, setActive] = useState('Dashboard')
  // CHESS ARENA SETUP
const [chessMode, setChessMode] = useState('standard')
// CHESS GAME ENGINE
const chessRef = useRef(new Chess())
const stockfishRef = useRef(null)

const [chessFen, setChessFen] = useState(
  chessRef.current.fen()
)
const [engineReady, setEngineReady] = useState(false)
const [aiThinking, setAiThinking] = useState(false)
const [selectedSquare, setSelectedSquare] = useState(null)
const [legalMoves, setLegalMoves] = useState([])
const [moveHistory, setMoveHistory] = useState([])
const [chessStatus, setChessStatus] = useState('WHITE TURN')
const [chessSide, setChessSide] = useState('random')
const [chessPlayerColor, setChessPlayerColor] = useState('white')

function startChessGame() {
  const finalColor =
    chessSide === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : chessSide

  chessRef.current = new Chess()

  setChessPlayerColor(finalColor)
  setChessFen(chessRef.current.fen())
  setSelectedSquare(null)
  setLegalMoves([])
  setMoveHistory([])
  setAiThinking(false)
  setChessStatus('WHITE TURN')

  setActive('Catur')
}
function getChessStatus(game) {
  if (game.isCheckmate()) {
    return `CHECKMATE — ${game.turn() === 'w' ? 'BLACK' : 'WHITE'} WINS`
  }

  if (game.isStalemate()) {
    return 'DRAW — STALEMATE'
  }

  if (game.isDraw()) {
    return 'DRAW — GAME OVER'
  }

  if (game.isCheck()) {
    return `${game.turn() === 'w' ? 'WHITE' : 'BLACK'} IN CHECK`
  }

  return `${game.turn() === 'w' ? 'WHITE' : 'BLACK'} TURN`
}
// HANDLE PLAYER CHESS MOVE
function handleChessSquareClick(square) {
  const game = chessRef.current

  if (active !== 'Catur') return
  if (aiThinking) return
  if (game.isGameOver()) return

  const playerTurn = chessPlayerColor === 'white' ? 'w' : 'b'

  // Pastikan hanya giliran pemain
  if (game.turn() !== playerTurn) return

  const clickedPiece = game.get(square)

  // Jika sudah memilih bidak sebelumnya
  if (selectedSquare) {
    // Jika kotak yang diklik adalah tujuan legal
    if (legalMoves.includes(square)) {
      try {
        game.move({
          from: selectedSquare,
          to: square,
          promotion: 'q'
        })

        setChessFen(game.fen())
        setMoveHistory(game.history())
        setChessStatus(getChessStatus(game))
        setSelectedSquare(null)
        setLegalMoves([])

        return
      } catch (error) {
        console.error('Chess move error:', error)
      }
    }
  }

  // Pilih bidak milik pemain
  if (clickedPiece && clickedPiece.color === playerTurn) {
    setSelectedSquare(square)

    const moves = game.moves({
      square,
      verbose: true
    })

    setLegalMoves(moves.map(move => move.to))
  } else {
    setSelectedSquare(null)
    setLegalMoves([])
  }
}
// STOCKFISH ENGINE CONNECTION
useEffect(() => {
  if (active !== 'Catur') return

  setEngineReady(false)

  const worker = new Worker(
    '/engine/stockfish-19-lite-single.js'
  )

  stockfishRef.current = worker

  worker.onmessage = (event) => {
    const line = String(event.data || '')

    if (line.includes('uciok')) {
      worker.postMessage('isready')
    }

    if (line.includes('readyok')) {
      setEngineReady(true)
    }

    if (line.startsWith('bestmove')) {
      const uci = line.split(/\s+/)[1]

      if (!uci || uci === '(none)' || uci === '0000') {
        setAiThinking(false)
        return
      }

      try {
        const move = chessRef.current.move({
          from: uci.substring(0, 2),
          to: uci.substring(2, 4),
          promotion: uci[4] || 'q'
        })

        if (move) {
          setChessFen(chessRef.current.fen())
          setMoveHistory(chessRef.current.history())
          setChessStatus(getChessStatus(chessRef.current))
          setSelectedSquare(null)
          setLegalMoves([])
        }
      } catch (error) {
        console.error('Stockfish move error:', error)
      }

      setAiThinking(false)
    }
  }

  worker.onerror = (error) => {
    console.error('Stockfish gagal dimuat:', error)
    setChessStatus('ENGINE ERROR')
    setAiThinking(false)
  }

  worker.postMessage('uci')

  return () => {
    worker.terminate()
    stockfishRef.current = null
    setEngineReady(false)
  }
}, [active])
// AUTOMATIC AI TURN
useEffect(() => {
  if (active !== 'Catur') return
  if (!engineReady) return
  if (aiThinking) return
  if (chessRef.current.isGameOver()) return

  const playerTurn = chessPlayerColor === 'white' ? 'w' : 'b'

  if (chessRef.current.turn() === playerTurn) return

  const thinkingTime = {
    lite: 200,
    standard: 500,
    strong: 900,
    maximum: 1500
  }

  const time = thinkingTime[chessMode] || 500

  setAiThinking(true)

  stockfishRef.current.postMessage(
    `position fen ${chessFen}`
  )

  stockfishRef.current.postMessage(
    `go movetime ${time}`
  )
}, [
  active,
  engineReady,
  chessFen,
  chessPlayerColor,
  chessMode,
  aiThinking
])
const [previousPage, setPreviousPage] = useState('Dashboard')
const [selectedNumber, setSelectedNumber] = useState(0)
const [enteringMath, setEnteringMath] = useState(false)
const [enteringPlaceValue, setEnteringPlaceValue] = useState(false)
const [enteringBasicMath, setEnteringBasicMath] = useState(false)
const [basicMathParticles, setBasicMathParticles] = useState([])
const [basicMathResult, setBasicMathResult] = useState(0)
const [basicAnswer, setBasicAnswer] = useState('')
const [basicQuestion, setBasicQuestion] = useState(0)
const [basicFeedback, setBasicFeedback] = useState('')

const enterPlaceValue = () => {
  if (enteringPlaceValue) return

  setEnteringPlaceValue(true)

  setTimeout(() => {
    setActive('Nilai Tempat')
    setEnteringPlaceValue(false)
  }, 2400)
}

const openMatematika = () => {
  setPreviousPage(active)
  setActive('Matematika')
}
const enterBasicMath = () => {
  if (enteringBasicMath) return

  const particles = Array.from({ length: 32 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 35 + Math.random() * 35

    return {
      id: i,
      value: Math.random() > 0.35
        ? String(Math.floor(Math.random() * 90) + 1)
        : Math.random() > 0.5 ? '+' : '−',
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: Math.random() * 0.7,
      size: 18 + Math.random() * 25,
    }
  })

  setBasicMathParticles(particles)
  setBasicMathResult(Math.floor(Math.random() * 90) + 10)
  setEnteringBasicMath(true)

  setTimeout(() => {
    setActive('Dasar')
    setEnteringBasicMath(false)
  }, 3800)
}
const basicMathQuestions = [
  {
    question: '12 + 8',
    answer: 20,
    explanation: '12 ditambah 8 menghasilkan 20.'
  },
  {
    question: '25 - 9',
    answer: 16,
    explanation: '25 dikurangi 9 menghasilkan 16.'
  },
  {
    question: '34 + 15',
    answer: 49,
    explanation: '34 + 10 = 44, kemudian 44 + 5 = 49.'
  },
  {
    question: '50 - 23',
    answer: 27,
    explanation: '50 - 20 = 30, kemudian 30 - 3 = 27.'
  },
  {
    question: '45 + 27',
    answer: 72,
    explanation: '45 + 20 = 65, lalu 65 + 7 = 72.'
  }
]

const checkBasicAnswer = () => {
  const current = basicMathQuestions[basicQuestion]

  if (basicAnswer.trim() === '') {
    setBasicFeedback('Masukkan jawaban terlebih dahulu!')
    return
  }

  if (Number(basicAnswer) === current.answer) {
    setBasicFeedback(`BENAR! ${current.explanation}`)
  } else {
    setBasicFeedback('Belum tepat. Coba hitung kembali, ya!')
  }
}

const nextBasicQuestion = () => {
  setBasicQuestion((prev) => (prev + 1) % basicMathQuestions.length)
  setBasicAnswer('')
  setBasicFeedback('')
}
const enterNumberLearning = () => {
  if (enteringMath) return

  setSelectedNumber(0)
  setEnteringMath(true)

  setTimeout(() => {
    setActive('Mengenal Angka')
    setEnteringMath(false)
  }, 1800)
}
  useEffect(() => {
  if (active === 'Admin' && user?.role === 'admin') {
    fetchAdminUsers()
  }
}, [active, user])
  const [messages, setMessages] = useState([
  {
    role: 'assistant',
    content: 'Halo, Explorer! Aku JARVIS, tutor pribadimu. Ada materi yang ingin kamu pelajari hari ini?'
  }
])

const [input, setInput] = useState('')
const [isLoading, setIsLoading] = useState(false)
const [isGeneratingImage, setIsGeneratingImage] = useState(false)
const [chatError, setChatError] = useState('')
const [quotaModal, setQuotaModal] = useState(null)

async function sendMessage(event) {
  event.preventDefault();

  const message = input.trim();

  if ((!message && !chatPhoto) || isLoading) return;

  const imageToSend = chatPhoto;

  const wantsImage =
    !imageToSend &&
    /\b(buatkan|buat|bikin|generate|ciptakan)\b.*\b(gambar|image|ilustrasi)\b|\b(gambarkan|ilustrasikan)\b/i.test(message);

  setMessages(prev => [
    ...prev,
    {
      role: 'user',
      content: message || 'Tolong analisis gambar ini.',
      image: imageToSend
    }
  ]);

  setInput('');
  setChatPhoto(null);
  setIsLoading(true);
  setIsGeneratingImage(wantsImage);
  setChatError('');

  try {
    // GENERATE GAMBAR MELALUI CLOUDFLARE
    if (wantsImage) {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: message
        })
      });

      const data = await response.json();

if (response.status === 429 && data.code === 'QUOTA_EXCEEDED') {
  setQuotaModal({
    feature: 'image',
    resetAt: data.resetAt
  })
  return
}

if (!response.ok || !data.success || !data.image) {
        throw new Error(
          data.error || 'Gagal membuat gambar.'
        );
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Gambar berhasil dibuat! 🎨',
          image: data.image
        }
      ]);

      return;
    }

    // CHAT GEMINI TETAP DIPERTAHANKAN
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message || 'Tolong analisis gambar ini.',
        image: imageToSend
      })
    });

    const data = await response.json();

if (response.status === 429 && data.code === 'QUOTA_EXCEEDED') {
  setQuotaModal({
    feature: 'chat',
    resetAt: data.resetAt
  })
  return
}

if (!response.ok) {
      throw new Error(
        data.error || 'JARVIS sedang mengalami gangguan.'
      );
    }

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: data.reply,
        image: data.image || null
      }
    ]);

  } catch (error) {
    setChatError(
      error.message || 'Gagal menghubungi JARVIS.'
    );
  } finally {
    setIsLoading(false);
    setIsGeneratingImage(false);
  }
}


  const menu = [
  ['⌂', 'Dashboard'],
  ['▤', 'Belajar'],
  ['◈', 'Quiz'],
  ['🎮', 'Games'],
  ['✧', 'JARVIS'],
  ['⚑', 'Misi'],
  ...(user?.role === 'admin' ? [['⚙', 'Admin']] : []),
]

  const stats = [
    { icon: '⚡', label: 'TOTAL XP', value: '0', note: 'Mulai petualanganmu' },
    { icon: '📚', label: 'MATERI', value: '0/100', note: 'Materi diselesaikan' },
    { icon: '🔥', label: 'STREAK', value: '0 Hari', note: 'Bangun konsistensi' },
  ]

    if (authChecking) {
    return (
      <div className="auth-screen">
        <h1>ITB <span>QUEST</span></h1>
        <p>Memeriksa sesi Explorer...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">IQ</div>

          <span className="section-kicker">
            YOUR FUTURE STARTS HERE
          </span>

          <h1>
            {authMode === 'login' ? 'WELCOME BACK.' : 'JOIN THE QUEST.'}
          </h1>

          <p>
            {authMode === 'login'
              ? 'Masuk untuk melanjutkan perjalananmu.'
              : 'Buat akun dan mulai perjalanan menjadi future engineer.'}
          </p>

          <form onSubmit={handleAuth}>
            <label>Email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Masukkan email"
              required
            />

            <label>Password</label>
            <div className="password-wrapper">
  <input
    type={showPassword ? 'text' : 'password'}
    value={authPassword}
    onChange={(e) => setAuthPassword(e.target.value)}
    placeholder="Minimal 10 karakter"
    minLength={10}
    maxLength={128}
    required
  />

  <button
  type="button"
  className="password-toggle"
  onClick={() => setShowPassword(!showPassword)}
  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
>
  {showPassword ? (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M10.6 10.6A2 2 0 0013.4 13.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15 15 0 01-3.1 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7c1.2 0 2.3-.3 3.3-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )}
</button>
</div>

            {authError && (
              <p className="auth-error">{authError}</p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={authLoading}
            >
              {authLoading
                ? 'PLEASE WAIT...'
                : authMode === 'login'
                  ? 'LOGIN →'
                  : 'CREATE ACCOUNT →'}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === 'login'
              ? "Belum punya akun?"
              : 'Sudah punya akun?'}

            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                setAuthError('')
              }}
            >
              {authMode === 'login' ? 'Register' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">IQ</div>
          <div>
            <h2>ITB QUEST</h2>
            <span>YOUR FUTURE STARTS HERE</span>
          </div>
        </div>

        <div className="menu-label">MAIN MENU</div>

        <nav>
          {menu.map(([icon, name]) => (
            <button
              key={name}
              className={`nav-item ${active === name ? 'active' : ''}`}
              onClick={() => setActive(name)}
            >
              <span>{icon}</span>
              {name}
              {name === 'JARVIS' && <small>AI</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            SYSTEM ONLINE
          </div>
          <p>ITB QUEST v1.0</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>ITB QUEST</span>
            <b>/</b>
            {active}
          </div>
          <div className="profile">
            <div className="profile-info">
  <strong>{user?.email?.split('@')[0] || 'Explorer'}</strong>
  <span>Future Engineer</span>
</div>
            <button
  className="avatar"
  onClick={() => setShowProfile(true)}
  title="Ganti foto profil"
>
  {photo ? (
    <img src={photo} alt="Foto profil" />
  ) : (
    'S'
  )}
</button>
<button
  className="logout-btn"
  onClick={handleLogout}
>
  LOGOUT
</button>
          </div>
        </header>

        <div className={`page-content ${active === 'JARVIS' ? 'jarvis-active' : ''} ${active === 'Belajar' ? 'learning-active' : ''} ${active === 'Matematika' ? 'math-active' : ''}
        ${active === 'Games' ? 'games-active' : ''}`}>
          {active === 'Admin' && user?.role === 'admin' && (
  <section className="admin-page">
    <div className="admin-heading">
      <div>
        <span className="section-kicker">SYSTEM MANAGEMENT</span>
        <h1>Admin <span>Dashboard.</span></h1>
        <p>Pantau akun dan penggunaan ITB QUEST.</p>
      </div>

      <button
        className="primary-btn"
        onClick={fetchAdminUsers}
        disabled={adminLoading}
      >
        {adminLoading ? 'LOADING...' : '↻ REFRESH'}
      </button>
    </div>

    {adminError && (
      <p className="auth-error">{adminError}</p>
    )}

    <div className="admin-stats">
      <div className="stat-card">
        <span>TOTAL USERS</span>
        <h3>{adminUsers.length}</h3>
      </div>

      <div className="stat-card">
        <span>ADMIN ACCOUNTS</span>
        <h3>{adminUsers.filter(u => u.role === 'admin').length}</h3>
      </div>

      <div className="stat-card">
        <span>CHAT USED</span>
        <h3>{adminUsers.reduce((sum, u) => sum + Number(u.chat_used || 0), 0)}</h3>
      </div>

      <div className="stat-card">
        <span>IMAGES USED</span>
        <h3>{adminUsers.reduce((sum, u) => sum + Number(u.image_used || 0), 0)}</h3>
      </div>
    </div>

    <div className="panel admin-table-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">USER DATABASE</span>
          <h2>Registered Users</h2>
        </div>
        <span className="live-label">
          {adminUsers.length} ACCOUNTS
        </span>
      </div>

      {adminLoading ? (
        <p>Memuat data pengguna...</p>
      ) : adminUsers.length === 0 ? (
        <p>Belum ada data pengguna.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
  <th>Foto</th>
  <th>Email</th>
  <th>Role</th>
  <th>Terdaftar</th>
  <th>Chat</th>
  <th>Image</th>
  <th>Sesi Aktif</th>
</tr>
            </thead>
            <tbody>
              {adminUsers.map(u => (
                <tr key={u.id}>
  <td>
    {u.profile_photo_url ? (
      <img
        src={u.profile_photo_url}
        alt="Foto pengguna"
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          objectFit: 'cover'
        }}
      />
    ) : (
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#172d46',
          color: '#38bdf8',
          fontWeight: 'bold'
        }}
      >
        {u.email?.[0]?.toUpperCase() || '?'}
      </div>
    )}
  </td>
  <td>{u.email}</td>
                  <td>
                    <span className={`admin-role ${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString('id-ID')
                      : '-'}
                  </td>
                  <td>{u.chat_used ?? 0}/50</td>
                  <td>{u.image_used ?? 0}/5</td>
                  <td>{u.active_sessions ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}
{active === 'Matematika' && (
  <section className="math-page">
    <button
      className="math-back-button"
      onClick={() => setActive(previousPage)}
    >
      ← KEMBALI
    </button>

    <div className="math-header">
      <span className="section-kicker">MATHEMATICS MODULE</span>
      <h1>Belajar <span>Matematika.</span></h1>
      <p>Pilih materi yang ingin kamu pelajari.</p>
    </div>

    
<div className="math-material-grid">

  {/* MATERI 01 */}
  <div
    className="math-material-card number-feature-card"
    onClick={enterNumberLearning}
  >
    <div className="number-card-image">
      <img
        src="/images/mengenal-angka.png"
        alt="Ilustrasi belajar mengenal angka"
      />

      <span className="number-image-badge">MATERI 01</span>

      <div className="number-image-overlay">
        <span>INTERACTIVE LEARNING</span>
        <h2>Mengenal Angka</h2>
        <p>Mulai petualangan angka 0–10!</p>
      </div>
    </div>

    <div className="number-feature-footer">
      <span>EXPLORE LESSON</span>
      <span>↗</span>
    </div>
  </div>

  {/* MATERI 02 */}
  <div
    className="math-material-card number-feature-card"
    onClick={enterPlaceValue}
  >
    <div className="number-card-image">
      <img
        src="/images/nilai-tempat.png"
        alt="Ilustrasi belajar nilai tempat"
      />

      <span className="number-image-badge">MATERI 02</span>

      <div className="number-image-overlay">
        <span>INTERACTIVE LEARNING</span>
        <h2>Mengetahui Nilai Tempat</h2>
        <p>Kenali satuan, puluhan, ratusan, dan ribuan!</p>
      </div>
    </div>

    <div className="number-feature-footer">
      <span>EXPLORE LESSON</span>
      <span>↗</span>
    </div>
  </div>

  {/* MATERI 03 */}
  <div
    className="math-material-card number-feature-card"
    onClick={enterBasicMath}
    style={{ cursor: 'pointer' }}
  >
    <div className="number-card-image construction-placeholder">
      <span className="number-image-badge">MATERI 03</span>

      <div className="construction-content">
        <span className="construction-icon">🚧</span>
        <h2>GAMBAR MASIH DALAM PEMBANGUNAN</h2>
        <p>Ilustrasi materi sedang disiapkan.</p>
      </div>

      <div className="number-image-overlay">
        <span>MATHEMATICS FUNDAMENTAL</span>
        <h2>Dasar Penjumlahan & Pengurangan</h2>
        <p>Kenali dasar operasi hitung matematika!</p>
      </div>
    </div>

    <div className="number-feature-footer">
      <span>EXPLORE LESSON</span>
      <span>↗</span>
    </div>
  </div>

</div>

  </section>
)}
{active === 'Mengenal Angka' && (
  <section className="number-learning-page">
    <button
      className="math-back-button"
      onClick={() => setActive('Matematika')}
    >
      ← KEMBALI
    </button>

    <div className="number-learning-header">
      <span className="subject-kicker">MATEMATIKA • MATERI 01</span>
      <h1>Mengenal Angka</h1>
      <p>Yuk, kenali angka dari nol sampai sepuluh!</p>
    </div>

    <div className="number-display">
      <span>ANGKA YANG KAMU PILIH</span>
      <h2>{selectedNumber}</h2>
      <h3>
        {[
          'Nol', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
          'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh'
        ][selectedNumber]}
      </h3>
    </div>

    <h2 className="number-grid-title">PILIH ANGKA</h2>

    <div className="number-grid">
      {[
        'Nol', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
        'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh'
      ].map((name, index) => (
        <button
          key={index}
          className={`number-card ${selectedNumber === index ? 'selected' : ''}`}
          onClick={() => setSelectedNumber(index)}
        >
          <strong>{index}</strong>
          <span>{name}</span>
        </button>
      ))}
    </div>

    <div className="number-navigation">
      <button
        disabled={selectedNumber === 0}
        onClick={() => setSelectedNumber(n => n - 1)}
      >
        ← Sebelumnya
      </button>

      <button
        disabled={selectedNumber === 10}
        onClick={() => setSelectedNumber(n => n + 1)}
      >
        Selanjutnya →
      </button>
    </div>
  </section>
)}
{active === 'Nilai Tempat' && (
  <section className="number-learning-page place-value-page">
    <button
      className="math-back-button"
      onClick={() => setActive('Matematika')}
    >
      ← KEMBALI
    </button>

    <div className="number-learning-header">
      <span className="subject-kicker">MATERI 02 · MATEMATIKA</span>
      <h1>Mengetahui Nilai Tempat</h1>
      <p>
        Yuk, pelajari nilai setiap angka berdasarkan posisinya!
      </p>
    </div>

    <div className="place-value-hero">
      <div className="place-value-intro">
        <span className="subject-kicker">KENALI ANGKANYA</span>
        <h2>Setiap angka punya tempat!</h2>
        <p>
          Dalam sebuah bilangan, posisi angka menentukan nilainya.
          Perhatikan contoh bilangan di bawah ini.
        </p>
      </div>

      <div className="place-value-number">
        {[
          { digit: '1', name: 'Ribuan', value: '1.000' },
          { digit: '2', name: 'Ratusan', value: '200' },
          { digit: '3', name: 'Puluhan', value: '30' },
          { digit: '4', name: 'Satuan', value: '4' }
        ].map((item, index) => (
          <div className="place-value-digit" key={item.name}>
            <strong>{item.digit}</strong>
            <span>{item.name}</span>
            <small>{item.value}</small>
          </div>
        ))}
      </div>

      <div className="place-value-total">
        <span>JADI, NILAI BILANGAN 1.234 ADALAH</span>
        <strong>1.000 + 200 + 30 + 4</strong>
      </div>
    </div>

    <div className="place-value-grid">
      <div className="place-value-card">
        <span>01</span>
        <h3>Satuan</h3>
        <strong>4</strong>
        <p>Posisi paling kanan. Contoh: angka 4 bernilai 4.</p>
      </div>

      <div className="place-value-card">
        <span>02</span>
        <h3>Puluhan</h3>
        <strong>30</strong>
        <p>Posisi kedua dari kanan. Contoh: angka 3 bernilai 30.</p>
      </div>

      <div className="place-value-card">
        <span>03</span>
        <h3>Ratusan</h3>
        <strong>200</strong>
        <p>Posisi ketiga dari kanan. Contoh: angka 2 bernilai 200.</p>
      </div>

      <div className="place-value-card">
        <span>04</span>
        <h3>Ribuan</h3>
        <strong>1.000</strong>
        <p>Posisi keempat dari kanan. Contoh: angka 1 bernilai 1.000.</p>
      </div>
    </div>
  </section>
)}
{active === 'Dasar' && (
  <section className="number-learning-page basic-math-page">

    <button
      className="math-back-button"
      onClick={() => setActive('Matematika')}
    >
      ← KEMBALI
    </button>

    <div className="number-learning-header">
      <span className="subject-kicker">
        MATERI 03 · MATEMATIKA FUNDAMENTAL
      </span>

      <h1>Penjumlahan & Pengurangan</h1>

      <p>
        Kuasai dua operasi dasar matematika dan temukan
        bagaimana angka bekerja bersama!
      </p>
    </div>

    <div className="basic-math-hero">
      <span>MATHEMATICAL FUNDAMENTALS</span>
      <h2>THE POWER OF NUMBERS</h2>
      <p>
        Penjumlahan dan pengurangan adalah dasar untuk
        memahami berbagai operasi matematika.
      </p>

      <div className="basic-math-symbols">
        <span>+</span>
        <span>−</span>
        <span>=</span>
      </div>
    </div>

    {/* PENJUMLAHAN */}

    <div className="basic-lesson-card">
      <div className="basic-lesson-number">01</div>

      <div className="basic-lesson-content">
        <span className="subject-kicker">OPERASI PERTAMA</span>
        <h2>Penjumlahan (+)</h2>

        <p>
          Penjumlahan adalah operasi matematika untuk
          menggabungkan dua bilangan atau lebih sehingga
          menghasilkan jumlah yang baru.
        </p>

        <div className="basic-example-box">
          <h3>CONTOH PENJUMLAHAN</h3>

          <div className="basic-equation">
            <span>5</span>
            <span className="operator">+</span>
            <span>3</span>
            <span className="operator">=</span>
            <span className="result">8</span>
          </div>

          <p>
            Bayangkan kamu memiliki 5 apel, kemudian mendapatkan
            3 apel lagi. Sekarang kamu memiliki 8 apel.
          </p>
        </div>

        <h3>Bagaimana cara menghitungnya?</h3>

        <ol>
          <li>Mulai dari angka pertama, yaitu 5.</li>
          <li>Tambahkan 3 angka berikutnya.</li>
          <li>Hitung maju: 6, 7, 8.</li>
          <li>Jadi, hasilnya adalah 8.</li>
        </ol>

        <div className="basic-tip">
          <strong>TIP JARVIS</strong>
          <p>
            Penjumlahan membuat jumlah bilangan menjadi lebih
            besar atau tetap sama jika ditambahkan nol.
          </p>
        </div>
      </div>
    </div>

    {/* PENGURANGAN */}

    <div className="basic-lesson-card">
      <div className="basic-lesson-number">02</div>

      <div className="basic-lesson-content">
        <span className="subject-kicker">OPERASI KEDUA</span>
        <h2>Pengurangan (−)</h2>

        <p>
          Pengurangan adalah operasi matematika untuk mengambil
          sebagian nilai dari suatu bilangan sehingga menghasilkan
          selisih.
        </p>

        <div className="basic-example-box">
          <h3>CONTOH PENGURANGAN</h3>

          <div className="basic-equation">
            <span>9</span>
            <span className="operator">−</span>
            <span>4</span>
            <span className="operator">=</span>
            <span className="result">5</span>
          </div>

          <p>
            Kamu memiliki 9 apel, kemudian memberikan 4 apel
            kepada teman. Sekarang tersisa 5 apel.
          </p>
        </div>

        <h3>Bagaimana cara menghitungnya?</h3>

        <ol>
          <li>Mulai dari angka 9.</li>
          <li>Kurangi sebanyak 4.</li>
          <li>Hitung mundur: 8, 7, 6, 5.</li>
          <li>Jadi, hasilnya adalah 5.</li>
        </ol>

        <div className="basic-tip">
          <strong>TIP JARVIS</strong>
          <p>
            Pengurangan digunakan untuk mencari sisa atau
            selisih antara dua bilangan.
          </p>
        </div>
      </div>
    </div>

    {/* LATIHAN */}

    <div className="basic-practice-card">
      <span className="subject-kicker">JARVIS TRAINING SYSTEM</span>
      <h2>Uji Kemampuanmu!</h2>

      <p>
        Selesaikan soal berikut untuk menguji pemahamanmu.
      </p>

      <div className="basic-question-number">
        SOAL {basicQuestion + 1} / {basicMathQuestions.length}
      </div>

      <div className="basic-question">
        {basicMathQuestions[basicQuestion].question} = ?
      </div>

      <input
        type="number"
        value={basicAnswer}
        onChange={(e) => {
          setBasicAnswer(e.target.value)
          setBasicFeedback('')
        }}
        placeholder="Masukkan jawaban..."
        className="basic-answer-input"
      />

      <div className="basic-practice-actions">
        <button onClick={checkBasicAnswer}>
          PERIKSA JAWABAN
        </button>

        <button onClick={nextBasicQuestion}>
          SOAL BERIKUTNYA →
        </button>
      </div>

      {basicFeedback && (
        <div className="basic-feedback">
          {basicFeedback}
        </div>
      )}
    </div>

  </section>
)}
{active === 'Belajar' && (
  <section className="learning-page">
    <div className="learning-hero">
      <div className="learning-hero-content">
        <span className="section-kicker">KNOWLEDGE CENTER</span>
        <h1>EXPLORE YOUR <span>UNIVERSE.</span></h1>
        <p>
          Perluas wawasan, temukan hal baru, dan mulai
          perjalananmu menjadi future engineer.
        </p>
        <div className="learning-hero-status">
          <span className="status-dot" />
          3 SUBJECTS AVAILABLE
        </div>
      </div>

      <div className="learning-orbit">
        <div className="learning-orbit-ring ring-one" />
        <div className="learning-orbit-ring ring-two" />
        <div className="learning-orbit-core">IQ</div>
        <span className="orbit-symbol symbol-one">π</span>
        <span className="orbit-symbol symbol-two">⚛</span>
        <span className="orbit-symbol symbol-three">∑</span>
      </div>
    </div>

    <div className="learning-section-heading">
      <div>
        <span className="section-kicker">SELECT YOUR SUBJECT</span>
        <h2>Learning <span>Modules.</span></h2>
        <p>Pilih bidang ilmu yang ingin kamu jelajahi.</p>
      </div>
      <span className="learning-count">03 / 03 SUBJECTS</span>
    </div>

    <div className="subject-grid">
      <div
  className="subject-card math-card"
  onClick={openMatematika}
>
        <div className="subject-card-top">
          <span className="subject-number">01</span>
          <span className="subject-category">LOGIC & NUMBERS</span>
        </div>

        <div className="subject-visual math-visual">
          <span className="math-symbol symbol-pi">π</span>
          <span className="math-symbol symbol-sigma">Σ</span>
          <span className="math-symbol symbol-root">√x</span>
          <span className="math-symbol symbol-integral">∫</span>
          <div className="math-core">∑</div>
        </div>

        <div className="subject-info">
          <span className="subject-kicker">SUBJECT 01</span>
          <h3>Matematika<span>.</span></h3>
          <p>
            Jelajahi angka, pola, aljabar, geometri,
            hingga konsep kalkulus.
          </p>
          <div className="subject-tags">
            <span>Aljabar</span>
            <span>Geometri</span>
            <span>Kalkulus</span>
          </div>
        </div>

        <div className="subject-card-footer">
          <span>KNOWLEDGE MODULE</span>
          <span className="subject-arrow">↗</span>
        </div>
      </div>

      <div className="subject-card physics-card">
        <div className="subject-card-top">
          <span className="subject-number">02</span>
          <span className="subject-category">SCIENCE & ENERGY</span>
        </div>

        <div className="subject-visual physics-visual">
          <div className="physics-orbit orbit-a" />
          <div className="physics-orbit orbit-b" />
          <div className="physics-core">⚛</div>
          <span className="physics-formula formula-a">F = ma</span>
          <span className="physics-formula formula-b">E = mc²</span>
        </div>

        <div className="subject-info">
          <span className="subject-kicker">SUBJECT 02</span>
          <h3>Fisika<span>.</span></h3>
          <p>
            Pahami cara alam semesta bekerja melalui
            energi, gerak, gaya, dan gelombang.
          </p>
          <div className="subject-tags">
            <span>Mekanika</span>
            <span>Energi</span>
            <span>Gelombang</span>
          </div>
        </div>

        <div className="subject-card-footer">
          <span>KNOWLEDGE MODULE</span>
          <span className="subject-arrow">↗</span>
        </div>
      </div>

      <div className="subject-card astronomy-card">
        <div className="subject-card-top">
          <span className="subject-number">03</span>
          <span className="subject-category">SPACE & COSMOS</span>
        </div>

        <div className="subject-visual astronomy-visual">
          <div className="space-orbit space-orbit-one" />
          <div className="space-orbit space-orbit-two" />
          <div className="space-planet">◉</div>
          <span className="space-star star-a">✦</span>
          <span className="space-star star-b">✧</span>
          <span className="space-star star-c">✦</span>
          <span className="space-moon">◐</span>
        </div>

        <div className="subject-info">
          <span className="subject-kicker">SUBJECT 03</span>
          <h3>Astronomi<span>.</span></h3>
          <p>
            Kenali planet, bintang, galaksi, dan
            misteri luasnya alam semesta.
          </p>
          <div className="subject-tags">
            <span>Tata Surya</span>
            <span>Bintang</span>
            <span>Galaksi</span>
          </div>
        </div>

        <div className="subject-card-footer">
          <span>KNOWLEDGE MODULE</span>
          <span className="subject-arrow">↗</span>
        </div>
      </div>
    </div>

    <div className="learning-bottom-note">
      <span>✦</span>
      KNOWLEDGE IS THE FIRST STEP TO GREATNESS.
      <span>✦</span>
    </div>
  </section>
)}
{active === 'Games' && (
  <section className="games-page">

    <div className="games-topbar">
      <div>
        <span className="games-kicker">ITB QUEST · ENTERTAINMENT CENTER</span>
        <h1>GAMES <span>HUB</span></h1>
        <p>TAKE A BREAK. EXPLORE ANOTHER DIMENSION.</p>
      </div>

      <div className="games-status">
        <span className="games-status-dot"></span>
        ARCADE SYSTEM ONLINE
      </div>
    </div>

    <div className="games-hero">
      <div className="games-hero-content">
        <span className="games-label">WELCOME TO THE ARCADE</span>
        <h2>YOUR NEXT<br /><span>ADVENTURE</span><br />STARTS HERE.</h2>
        <p>
          Tinggalkan sejenak rutinitas belajar dan jelajahi
          dunia hiburan futuristik ITB QUEST.
        </p>
        <div className="games-hero-tag">
          <span>✦</span> GAMING DIMENSION
        </div>
      </div>

      <div className="games-hero-visual">
        <div className="games-orbit orbit-a"></div>
        <div className="games-orbit orbit-b"></div>
        <div className="games-orbit orbit-c"></div>
        <div className="games-planet">
          <span>GAME</span>
          <strong>ZONE</strong>
          <div className="games-planet-light"></div>
        </div>
        <div className="games-floating-symbol symbol-a">✦</div>
        <div className="games-floating-symbol symbol-b">◈</div>
        <div className="games-floating-symbol symbol-c">+</div>
      </div>
    </div>

    <div className="games-section-heading">
      <div>
        <span className="games-kicker">EXPLORE THE UNIVERSE</span>
        <h2>ARCADE COLLECTION</h2>
      </div>
      <span className="games-coming">NEW EXPERIENCES AWAIT</span>
    </div>

    <div className="games-card-grid">

      <div className="games-card games-card-one">
        <div className="games-card-art">
          <div className="games-art-glow"></div>
          <div className="games-art-icon">🚀</div>
          <span className="games-art-code">ZONE 01</span>
        </div>
        <div className="games-card-info">
          <span>SPACE ADVENTURE</span>
          <h3>GALAXY RUNNER</h3>
          <p>EXPLORE THE UNKNOWN UNIVERSE.</p>
          <div className="games-card-bottom">
            <span>COMING SOON</span>
            <span>01 / 03</span>
          </div>
        </div>
      </div>

      <div
  className="games-card games-card-two"
  onClick={() => setActive('Neural Puzzle')}
  style={{ cursor: 'pointer' }}
>
        <div className="games-card-art">
          <div className="games-art-glow"></div>
          <div className="games-art-icon">🧩</div>
          <span className="games-art-code">ZONE 02</span>
        </div>
        <div className="games-card-info">
          <span>LOGIC CHALLENGE</span>
          <h3>NEURAL PUZZLE</h3>
          <p>CHALLENGE YOUR THINKING.</p>
          <div className="games-card-bottom">
            <span>COMING SOON</span>
            <span>02 / 03</span>
          </div>
        </div>
      </div>

      <div className="games-card games-card-three">
        <div className="games-card-art">
          <div className="games-art-glow"></div>
          <div className="games-art-icon">⚡</div>
          <span className="games-art-code">ZONE 03</span>
        </div>
        <div className="games-card-info">
          <span>ARCADE CHALLENGE</span>
          <h3>CYBER BLAST</h3>
          <p>ENTER THE DIGITAL BATTLEFIELD.</p>
          <div className="games-card-bottom">
            <span>COMING SOON</span>
            <span>03 / 03</span>
          </div>
        </div>
      </div>

    </div>

    <div className="games-footer">
      <span>ITB QUEST ARCADE SYSTEM</span>
      <span>YOUR WORLD. YOUR ADVENTURE.</span>
    </div>

  </section>
)}
{active === 'Neural Puzzle' && (
  <section className="neural-page">
    <button
      className="math-back-button"
      onClick={() => setActive('Games')}
    >
      ← KEMBALI
    </button>

    <div className="neural-header">
      <span>ITB QUEST · GAMES ZONE 02</span>
      <h1>NEURAL PUZZLE</h1>
      <p>CHALLENGE YOUR LOGIC. MASTER YOUR MIND.</p>
    </div>

    <div className="neural-game-grid">
      <div
        className="neural-game-card"
        onClick={() => setActive('Chess Setup')}
      >
        <div className="neural-game-icon">♟</div>
        <span>LOGIC GAME 01</span>
        <h2>CHESS</h2>
        <p>Uji strategi dan kecerdasanmu dalam permainan catur.</p>
        <div className="neural-play">ENTER GAME →</div>
      </div>
    </div>
  </section>
)}

{active === 'Chess Setup' && (
  <section className="chess-setup-page">

    <button
      className="math-back-button"
      onClick={() => setActive('Neural Puzzle')}
    >
      ← KEMBALI
    </button>

    <div className="chess-setup-header">
      <span>ITB QUEST · NEURAL SYSTEM</span>
      <h1>CHESS ARENA</h1>
      <p>CONFIGURE YOUR BATTLE</p>
    </div>

    <div className="chess-setup-panel">

      <div className="chess-setup-section">
        <span className="chess-setup-label">01 · ENGINE ANALYSIS</span>
        <h2>SELECT AI MODE</h2>
        <p>Choose your opponent's analysis level.</p>

        <div className="chess-mode-grid">

          <button
            className={`chess-mode-card ${chessMode === 'lite' ? 'selected' : ''}`}
            onClick={() => setChessMode('lite')}
          >
            <span>MODE 01</span>
            <h3>LITE</h3>
            <p>Analisis ringan dan cepat.</p>
          </button>

          <button
            className={`chess-mode-card ${chessMode === 'standard' ? 'selected' : ''}`}
            onClick={() => setChessMode('standard')}
          >
            <span>MODE 02</span>
            <h3>STANDARD</h3>
            <p>Analisis seimbang.</p>
          </button>

          <button
            className={`chess-mode-card ${chessMode === 'strong' ? 'selected' : ''}`}
            onClick={() => setChessMode('strong')}
          >
            <span>MODE 03</span>
            <h3>STRONG</h3>
            <p>Analisis lebih mendalam.</p>
          </button>

          <button
            className={`chess-mode-card ${chessMode === 'maximum' ? 'selected' : ''}`}
            onClick={() => setChessMode('maximum')}
          >
            <span>MODE 04</span>
            <h3>MAXIMUM</h3>
            <p>Analisis maksimal.</p>
          </button>

        </div>
      </div>

      <div className="chess-setup-divider"></div>

      <div className="chess-setup-section">
        <span className="chess-setup-label">02 · PLAYER CONFIGURATION</span>
        <h2>CHOOSE YOUR SIDE</h2>
        <p>Select your chess pieces.</p>

        <div className="chess-side-grid">

          <button
            className={`chess-side-card ${chessSide === 'white' ? 'selected' : ''}`}
            onClick={() => setChessSide('white')}
          >
            <span className="chess-side-symbol">♔</span>
            <strong>WHITE</strong>
            <small>PLAY AS WHITE</small>
          </button>

          <button
            className={`chess-side-card ${chessSide === 'black' ? 'selected' : ''}`}
            onClick={() => setChessSide('black')}
          >
            <span className="chess-side-symbol">♚</span>
            <strong>BLACK</strong>
            <small>PLAY AS BLACK</small>
          </button>

          <button
            className={`chess-side-card ${chessSide === 'random' ? 'selected' : ''}`}
            onClick={() => setChessSide('random')}
          >
            <span className="chess-side-symbol">⚄</span>
            <strong>RANDOM</strong>
            <small>LET SYSTEM DECIDE</small>
          </button>

        </div>
      </div>

      <div className="chess-setup-summary">
        <span>YOUR CONFIGURATION</span>
        <strong>{chessMode.toUpperCase()} MODE</strong>
        <small>PLAYER SIDE: {chessSide.toUpperCase()}</small>
      </div>

      <button
        className="chess-start-button"
        onClick={startChessGame}
      >
        START GAME <span>→</span>
      </button>

    </div>
  </section>
)}

{active === 'Catur' && (
  <section className="neural-page">
    <button
      className="math-back-button"
      onClick={() => setActive('Neural Puzzle')}
    >
      ← KEMBALI
    </button>

    <div className="neural-header">
      <span>NEURAL PUZZLE · GAME 01</span>
      <h1>CHESS</h1>
      <p>THE BATTLE OF STRATEGY BEGINS</p>
    </div>

    
<div className="holo-chess-container">
  <div className="holo-chess-top">
    <div>
      <span className="holo-chess-kicker">ITB QUEST · NEURAL SYSTEM</span>
      <h2>CHESS ARENA</h2>
      <p>HOLOGRAPHIC STRATEGY INTERFACE</p>
    </div>

    <div className="holo-chess-status">
      <span></span>
      SYSTEM ONLINE
    </div>
  </div>

  <div className="holo-board-frame">
    <div className="holo-board-glow"></div>

    <div className="holo-chess-board">
      {(
  chessPlayerColor === 'black'
    ? chessRef.current.board()
        .slice()
        .reverse()
        .map(row => row.slice().reverse())
    : chessRef.current.board()
).map((row, rowIndex) =>
  row.map((piece, colIndex) => {
    const fileIndex =
      chessPlayerColor === 'black'
        ? 7 - colIndex
        : colIndex

    const rank =
      chessPlayerColor === 'black'
        ? rowIndex + 1
        : 8 - rowIndex

    const square = `${'abcdefgh'[fileIndex]}${rank}`

    const isWhite = piece?.color === 'w'
    const pieceSymbol = piece
      ? isWhite
        ? piece.type.toUpperCase()
        : piece.type
      : '.'

    const isSelected = selectedSquare === square
    const isLegal = legalMoves.includes(square)

    return (
      <div
        key={square}
        onClick={() => handleChessSquareClick(square)}
        className={`holo-square ${
          (rowIndex + colIndex) % 2 === 0
            ? 'holo-square-light'
            : 'holo-square-dark'
        } ${
          isSelected ? 'holo-square-selected' : ''
        } ${
          isLegal ? 'holo-square-legal' : ''
        }`}
      >
        {colIndex === 0 && (
          <span className="holo-coordinate holo-rank">
            {rank}
          </span>
        )}

        {rowIndex === 7 && (
          <span className="holo-coordinate holo-file">
            {'abcdefgh'[fileIndex]}
          </span>
        )}

        {isLegal && (
          <span
            className={`holo-legal-marker ${
              piece ? 'holo-legal-capture' : ''
            }`}
          />
        )}

        {piece && (
          <span
            className={`holo-piece holo-piece-${pieceSymbol.toLowerCase()} ${
              isWhite
                ? 'holo-piece-white'
                : 'holo-piece-black'
            }`}
          >
            <CustomChessPiece
              piece={piece.type}
              color={isWhite ? 'white' : 'black'}
            />
          </span>
        )}
      </div>
    )
  })
)}
    </div>
  </div>

  <div className="holo-chess-bottom">
    <div className="holo-player">
      <span className="holo-player-icon white-player">♔</span>
      <div>
        <strong>WHITE</strong>
        <small>PLAYER ONE</small>
      </div>
    </div>

    <div className="holo-center-label">
      <span>VS</span>
      <small>NEURAL BATTLEFIELD</small>
    </div>

    <div className="holo-player">
      <span className="holo-player-icon black-player">♚</span>
      <div>
        <strong>BLACK</strong>
        <small>PLAYER TWO</small>
      </div>
    </div>
  </div>

  <div className="holo-chess-footer">
    <span>64 HOLOGRAPHIC CELLS</span>
    <span>CHESS ENGINE · INITIALIZING</span>
  </div>
</div>

  </section>
)}
          <section className="welcome">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> YOUR JOURNEY CONTINUES
              </div>
              <h1>Welcome back, <span>Explorer.</span></h1>
              <p>Setiap langkah kecil membawamu lebih dekat ke masa depan.</p>
            </div>
            <div className="level-badge">
              <span>✦</span>
              <div>
                <small>YOUR RANK</small>
                <strong>LEVEL 01</strong>
              </div>
            </div>
          </section>

          <section className="hero">
            <div className="hero-content">
              <div className="hero-tag">✦ MISSION CONTROL</div>
              <h2>BUILD YOUR<br /><span>FUTURE.</span></h2>
              <p>Think smarter. Learn faster. Become an engineer.</p>
              <button className="primary-btn" onClick={() => setActive('Belajar')}>
                START LEARNING <span>→</span>
              </button>
            </div>
            <div className="hero-visual">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="core">IQ</div>
              <div className="visual-caption">KNOWLEDGE<br />IS POWER</div>
            </div>
            <div className="hero-decoration">01 / 05</div>
          </section>

          <section className="section-heading">
            <div>
              <span className="section-kicker">YOUR PERFORMANCE</span>
              <h2>Overview</h2>
            </div>
            <span className="live-label">● LIVE TRACKING</span>
          </section>

          <section className="stats-grid">
            {stats.map((item) => (
              <div className="stat-card" key={item.label}>
                <div className="stat-top">
                  <span>{item.label}</span>
                  <div className="stat-icon">{item.icon}</div>
                </div>
                <h3>{item.value}</h3>
                <p>{item.note}</p>
              </div>
            ))}
          </section>

          <section className="lower-grid">
            <div className="panel progress-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">KEEP MOVING</span>
                  <h2>Learning progress</h2>
                </div>
                <span className="panel-icon">↗</span>
              </div>
              <div className="progress-empty">
                <div className="progress-ring">
                  <div>
                    <strong>0%</strong>
                    <span>COMPLETED</span>
                  </div>
                </div>
                <p>Perjalanan belajarmu dimulai dari sini.</p>
              </div>
            </div>

            <div className="panel mission-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">DAILY OBJECTIVES</span>
                  <h2>Daily missions</h2>
                </div>
                <span className="mission-count">0/3</span>
              </div>
              <div className="mission-item">
                <span className="mission-number">01</span>
                <div><strong>Math fundamentals</strong><small>Belajar matematika dasar</small></div>
                <span className="mission-xp">+50 XP</span>
              </div>
              <div className="mission-item">
                <span className="mission-number">02</span>
                <div><strong>Physics exploration</strong><small>Pelajari konsep fisika</small></div>
                <span className="mission-xp">+50 XP</span>
              </div>
              <div className="mission-item">
                <span className="mission-number">03</span>
                <div><strong>Daily challenge</strong><small>Selesaikan tantangan harian</small></div>
                <span className="mission-xp">+100 XP</span>
              </div>
            </div>
          </section>

          <footer>
            <span>ITB QUEST © 2026</span>
            <span>DESIGNED FOR FUTURE ENGINEERS ✦</span>
          </footer>

<section className="jarvis-page">

  
<div className="jarvis-banner">

  <div className="jarvis-bg-icons" aria-hidden="true">
    <span className="float-icon spider">🕸️</span>
    <span className="float-icon iron">🦾</span>
    <span className="float-icon math-one">π</span>
    <span className="float-icon math-two">√</span>
    <span className="float-icon math-three">∑</span>
    <span className="float-icon physics-one">E = mc²</span>
    <span className="float-icon physics-two">F = ma</span>
    <span className="float-icon atom">⚛️</span>
    <span className="float-icon spider-two">🕷️</span>
  </div>

  <div className="jarvis-intro">
    <span className="section-kicker">PERSONAL AI SYSTEM</span>
    <h1>HELLO, <span>EXPLORER.</span></h1>
    <p>
      Aku JARVIS. Siap membantu perjalananmu
      menjadi future engineer.
    </p>
    <div className="jarvis-status">
      <span className="status-dot" />
      GEMINI AI CONNECTED
    </div>
  </div>

</div>

  <div className="jarvis-chat-panel">
    <div className="chat-heading">
      <div>
        <span className="section-kicker">NEURAL INTERFACE</span>
        <h2>JARVIS CHAT</h2>
      </div>
      <span className="jarvis-online">● ONLINE</span>
    </div>

<div className="chat-messages">
  {messages.map((msg, index) => (
    <div
      key={index}
      className={`chat-message ${msg.role}`}
    >
      <small>
        {msg.role === 'assistant' ? 'JARVIS' : 'EXPLORER'}
      </small>

      {msg.image && (
  <img
    src={msg.image}
    alt="Lampiran percakapan"
    className="chat-image"
  />
)}

<div className="message-content">
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
  >
    {msg.content}
  </ReactMarkdown>
</div>
    </div>
  ))}

    {isLoading && (
    <div className="chat-message assistant">
      <small>JARVIS</small>
      <p>
        {isGeneratingImage
          ? 'JARVIS sedang menciptakan gambar... 🎨'
          : 'Sedang memproses pertanyaan...'}
      </p>
    </div>
  )}
</div>


    {chatError && (
      <p className="chat-error">{chatError}</p>
    )}

    {chatPhoto && (
  <div className="image-preview">
    <img src={chatPhoto} alt="Preview gambar" />
    <span>Gambar siap dikirim</span>
    <button
      type="button"
      onClick={() => setChatPhoto(null)}
    >
      Hapus
    </button>
  </div>
)}

<form className="chat-form" onSubmit={sendMessage}>
  <input
    ref={chatFileRef}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={handleChatPhoto}
    hidden
  />

  <button
    type="button"
    className="image-upload-btn"
    onClick={() => chatFileRef.current?.click()}
    disabled={isLoading}
    title="Unggah gambar"
  >
    📎
  </button>

  <input
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="Tanyakan sesuatu kepada JARVIS..."
    disabled={isLoading}
  />

  <button
    type="submit"
    disabled={isLoading || (!input.trim() && !chatPhoto)}
  >
    SEND ➤
  </button>
</form>
  </div>

</section>

        </div>
      </main>
      {showProfile && (
  <div className="modal-overlay">
    <div className="profile-modal">
      <button
        className="close-modal"
        onClick={() => setShowProfile(false)}
      >
        ×
      </button>

      <span className="section-kicker">PERSONAL SETTINGS</span>
      <h2>Profile picture</h2>
      <p>Personalisasi identitas Explorer kamu.</p>

      <div className="profile-preview">
        {photo ? (
          <img src={photo} alt="Preview profil" />
        ) : (
          <span>S</span>
        )}
      </div>

      <button
  className="profile-action"
  onClick={() => fileRef.current?.click()}
  disabled={photoUploading}
>
  {photoUploading ? 'MENGUNGGAH...' : '🖼️ Unggah Foto'}
</button>

      <button
        className="profile-action secondary"
        onClick={openCamera}
      >
        📷 Ambil Foto
      </button>

      <input
  ref={fileRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={uploadPhoto}
  hidden
/>
    </div>
  </div>
)}

{cameraOpen && (
  <div className="modal-overlay">
    <div className="profile-modal camera-modal">
      <button className="close-modal" onClick={stopCamera}>
        ×
      </button>

      <span className="section-kicker">CAMERA SYSTEM</span>
      <h2>Take your photo</h2>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
      />

      {cameraError && <p className="camera-error">{cameraError}</p>}

      <button
        className="profile-action"
        onClick={takePhoto}
        disabled={!!cameraError}
      >
        📸 Capture Photo
      </button>

      <button className="profile-action secondary" onClick={stopCamera}>
        Cancel
      </button>
    </div>
  </div>
)}

{quotaModal && (
  <div className="quota-overlay">
    <div className="quota-modal">
      <div className="quota-icon">⚠</div>

      <span className="section-kicker">
        ITB QUEST SECURITY SYSTEM
      </span>

      <h2>
        {quotaModal.feature === 'chat'
          ? 'CHAT LIMIT REACHED'
          : 'IMAGE LIMIT REACHED'}
      </h2>

      <h3>Kuota Harian Habis</h3>

      <p>
        {quotaModal.feature === 'chat'
          ? 'Kuota chat JARVIS hari ini sudah mencapai batas.'
          : 'Kuota generate gambar hari ini sudah mencapai batas.'}
      </p>

      <div className="quota-reset">
        <span>KUOTA TERSEDIA KEMBALI</span>

        <strong>
          {quotaModal.resetAt
            ? new Date(quotaModal.resetAt).toLocaleTimeString(
                'id-ID',
                {
                  timeZone: 'Asia/Makassar',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }
              ).replace(':', '.')
            : '00.00'} WITA
        </strong>

        <small>Reset otomatis setiap hari</small>
      </div>

      <button
        className="quota-close"
        onClick={() => setQuotaModal(null)}
      >
        MENGERTI
      </button>
    </div>
  </div>
)}
<canvas ref={canvasRef} hidden />
{enteringMath && (
  <div className="math-entry-animation">
    <div className="math-entry-glow"></div>

    <div className="math-entry-symbols">
      {['+', '−', '×', '÷', 'π', '√', '=', '∞', '1', '2', '3', '0'].map((symbol, i) => (
        <span key={i} style={{ '--i': i }}>
          {symbol}
        </span>
      ))}
    </div>

    <div className="math-entry-portal">
      <div className="math-entry-ring ring-one"></div>
      <div className="math-entry-ring ring-two"></div>
      <div className="math-entry-ring ring-three"></div>
      <div className="math-entry-core">MATH</div>
    </div>

    <h1>ENTERING MATHEMATICS</h1>
    <p>PREPARING YOUR LEARNING JOURNEY...</p>
  </div>
)}
{enteringPlaceValue && (
  <div className="place-entry-animation">
    <div className="place-entry-grid"></div>
    <div className="place-entry-flash"></div>

    <div className="place-entry-particles">
      {['1', '2', '3', '4', '+', '100', '10', '1000', '01', '02', '03', '04'].map((item, i) => (
        <span key={i} style={{ '--i': i }}>
          {item}
        </span>
      ))}
    </div>

    <div className="place-entry-title">
      <span>ITB QUEST · MATHEMATICS</span>
      <h1>PLACE VALUE</h1>
      <p>UNLOCKING THE POWER OF NUMBERS</p>
    </div>

    <div className="place-entry-portal">
      <div className="place-entry-ring place-ring-one"></div>
      <div className="place-entry-ring place-ring-two"></div>
      <div className="place-entry-ring place-ring-three"></div>

      <div className="place-entry-orbit">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
      </div>

      <div className="place-entry-core">
        <div className="place-entry-columns">
          <div><strong>1</strong><small>RIBUAN</small></div>
          <div><strong>2</strong><small>RATUSAN</small></div>
          <div><strong>3</strong><small>PULUHAN</small></div>
          <div><strong>4</strong><small>SATUAN</small></div>
        </div>
      </div>
    </div>

    <div className="place-entry-bottom">
      <span>INITIALIZING LEARNING DIMENSION</span>
      <div className="place-entry-progress">
        <div></div>
      </div>
      <small>PREPARING YOUR MATHEMATICAL JOURNEY...</small>
    </div>
  </div>
)}
{enteringBasicMath && (
  <div className="basic-entry-animation">

    <div className="basic-entry-grid"></div>
    <div className="basic-entry-vortex"></div>
    <div className="basic-entry-flash"></div>

    <div className="basic-entry-heading">
      <span>ITB QUEST · MATHEMATICS</span>
      <h1>MATHEMATICAL COLLISION</h1>
      <p>GENERATING MATHEMATICAL DIMENSION</p>
    </div>

    <div className="basic-entry-particles">
      {basicMathParticles.map((particle) => (
        <span
          key={particle.id}
          className="basic-entry-particle"
          style={{
            '--sx': `${particle.x}vw`,
            '--sy': `${particle.y}vh`,
            '--delay': `${particle.delay}s`,
            '--size': `${particle.size}px`,
          }}
        >
          {particle.value}
        </span>
      ))}
    </div>

    <div className="basic-entry-core">
      <div className="basic-core-ring basic-core-ring-one"></div>
      <div className="basic-core-ring basic-core-ring-two"></div>
      <div className="basic-core-ring basic-core-ring-three"></div>

      <div className="basic-core-result">
        {basicMathResult}
      </div>
    </div>

    <div className="basic-entry-bottom">
      <span>CALCULATING · COLLIDING · CREATING</span>
      <div className="basic-entry-progress">
        <div></div>
      </div>
      <small>ENTERING MATHEMATICAL DIMENSION...</small>
    </div>

  </div>
)}
    </div>
  )
}

export default App
