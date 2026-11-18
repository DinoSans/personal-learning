
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './App.css'

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
  ]

  const stats = [
    { icon: '⚡', label: 'TOTAL XP', value: '0', note: 'Mulai petualanganmu' },
    { icon: '📚', label: 'MATERI', value: '0/100', note: 'Materi diselesaikan' },
    { icon: '🔥', label: 'STREAK', value: '0 Hari', note: 'Bangun konsistensi' },
  ]

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
              <strong>Explorer</strong>
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
          </div>
        </header>

        <div className={`page-content ${active === 'JARVIS' ? 'jarvis-active' : ''}`}>
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

<canvas ref={canvasRef} hidden />
    </div>
  )
}

export default App
