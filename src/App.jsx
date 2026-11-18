
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './App.css'
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

    setUser(data.user)
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
  const [photo, setPhoto] = useState(() => {
  return localStorage.getItem('itbQuestProfilePhoto')
})
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

useEffect(() => {
  try {
    if (photo) {
      localStorage.setItem('itbQuestProfilePhoto', photo)
    } else {
      localStorage.removeItem('itbQuestProfilePhoto')
    }
  } catch (error) {
    console.error('Gagal menyimpan foto profil:', error)
    alert('Penyimpanan penuh. Coba gunakan foto yang lebih kecil.')
  }
}, [photo])
const [showProfile, setShowProfile] = useState(false)
const [cameraOpen, setCameraOpen] = useState(false)
const [cameraError, setCameraError] = useState('')

const fileRef = useRef(null)
const videoRef = useRef(null)
const streamRef = useRef(null)
const canvasRef = useRef(null)

function uploadPhoto(event) {
  const file = event.target.files[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Pilih file gambar, ya!')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Ukuran foto maksimal 5 MB.')
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    setPhoto(reader.result)
    setShowProfile(false)
  }

  reader.readAsDataURL(file)
  event.target.value = ''
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

function takePhoto() {
  const video = videoRef.current
  const canvas = canvasRef.current

  if (!video || !canvas || !video.videoWidth) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const context = canvas.getContext('2d')
  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  context.drawImage(video, 0, 0)

  setPhoto(canvas.toDataURL('image/jpeg', 0.85))
  stopCamera()
  setShowProfile(false)
}
  const [active, setActive] = useState('Dashboard')
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
const [showQuotaTest, setShowQuotaTest] = useState(true)

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

        <div className={`page-content ${active === 'JARVIS' ? 'jarvis-active' : ''}`}>
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

    <div className="message-content">
  <p>TES LATEX INLINE:</p>
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
  >
    {'$E = mc^2$'}
  </ReactMarkdown>

  <p>TES LATEX BESAR:</p>
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
  >
    {'$$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$'}
  </ReactMarkdown>
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
        onClick={() => fileRef.current.click()}
      >
        🖼️ Unggah Foto
      </button>

      <button
        className="profile-action secondary"
        onClick={openCamera}
      >
        📷 Ambil Foto
      </button>

      {photo && (
        <button
          className="remove-photo"
          onClick={() => setPhoto(null)}
        >
          Hapus foto profil
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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

{showQuotaTest && (
  <button
    onClick={() => setQuotaModal({
      feature: 'chat',
      resetAt: new Date().toISOString()
    })}
    style={{
      position: 'fixed',
      bottom: '100px',
      right: '20px',
      zIndex: 99998,
      padding: '12px 18px',
      background: '#38bdf8',
      color: '#06111f',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer'
    }}
  >
    TEST POPUP
  </button>
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
    </div>
  )
}

export default App
