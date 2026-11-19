import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import {
  MapPin,
  Flag,
  Footprints,
  Clock3,
  Route,
  Menu,
  Home,
  Trophy,
  Map as MapIcon,
  Settings,
  Play,
  Pause,
  Square,
  LocateFixed,
  Trash2,
  RotateCcw,
  Award,
  Navigation
} from 'lucide-react'
import walkSketch from './assets/tadataka_character.png'
import './App.css'

type Point = { lat: number; lng: number }
type WalkRecord = {
  id: string
  date: string
  from: string
  to: string
  steps: number
  seconds: number
  distance: number
  path: Point[]
}
type Phase = 'idle' | 'walking' | 'paused' | 'result'
type Tab = 'home' | 'records' | 'map' | 'settings'
type MascotMood = 'idle' | 'walk' | 'dango' | 'happy'

const TOKYO: Point = { lat: 35.6812, lng: 139.7671 }
const STORE_KEY = 'inotabi-records-v2'

const dotIcon = (color: string, label: string) =>
  L.divIcon({
    className: 'map-dot-wrap',
    html: `<div class="map-dot ${color}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })

function Recenter({ point }: { point: Point }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 1 })
  }, [point.lat, point.lng, map])
  return null
}

function EdoStage({ mood }: { mood: MascotMood }) {
  const isHappy = mood === 'happy'
  const currentImg = walkSketch
  const altText = isHappy
    ? 'あっぱれじゃ！と喜ぶ伊能忠敬の手書きイラスト'
    : '伊能忠敬の手書きイラスト'

  return (
    <div className={`edo-stage stage-${mood}`} aria-label="江戸街道と伊能忠敬のアニメーション">
      <div className="scroll-rod left" />
      <div className="scroll-rod right" />

      <div className="stage-viewport">
        <div className="bg-far" aria-hidden="true" />
        <div className="bg-near" aria-hidden="true" />

        {mood === 'dango' && (
          <div className="dango-shop" aria-hidden="true">
            <svg viewBox="0 0 240 120" className="dango-svg">
              <path d="M10 32 L28 8 L212 8 L230 32 Z" fill="#6e5a4f" stroke="#473830" strokeWidth="2" />
              <rect x="24" y="32" width="8" height="76" fill="#7c5638" stroke="#47301e" strokeWidth="1.5" />
              <rect x="208" y="32" width="8" height="76" fill="#7c5638" stroke="#47301e" strokeWidth="1.5" />
              <rect x="36" y="32" width="38" height="24" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="1.5" />
              <rect x="76" y="32" width="38" height="24" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="1.5" />
              <rect x="116" y="32" width="38" height="24" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="1.5" />
              <rect x="156" y="32" width="38" height="24" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="1.5" />
              <text x="55" y="49" textAnchor="middle" fill="#fff8e7" fontSize="12" fontWeight="bold">だ</text>
              <text x="95" y="49" textAnchor="middle" fill="#fff8e7" fontSize="12" fontWeight="bold">ん</text>
              <text x="135" y="49" textAnchor="middle" fill="#fff8e7" fontSize="12" fontWeight="bold">ご</text>
              <text x="175" y="49" textAnchor="middle" fill="#fff8e7" fontSize="12" fontWeight="bold">茶</text>
              <rect x="40" y="82" width="150" height="10" rx="2" fill="#d94e4e" stroke="#8a2b2b" strokeWidth="1.5" />
              <rect x="50" y="92" width="6" height="16" fill="#6b482e" />
              <rect x="174" y="92" width="6" height="16" fill="#6b482e" />
            </svg>
          </div>
        )}

        <div className="sketch-character-wrap">
          <img src={currentImg} alt={altText} className="sketch-character-img" />
        </div>
      </div>
    </div>
  )
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

function fmtDiff(diffSec: number) {
  const abs = Math.abs(diffSec)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function distance(a: Point, b: Point) {
  const r = 6371000
  const rad = (v: number) => (v * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}

function formatKm(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [phase, setPhase] = useState<Phase>('idle')
  const [here, setHere] = useState<Point>(TOKYO)
  const [path, setPath] = useState<Point[]>([])
  const [destination, setDestination] = useState<Point | null>(null)
  const [startText, setStartText] = useState('現在地')
  const [goalText, setGoalText] = useState('東京駅')
  const [seconds, setSeconds] = useState(0)
  const [steps, setSteps] = useState(0)
  const [meters, setMeters] = useState(0)
  const [recordUpdateDiff, setRecordUpdateDiff] = useState<number | null>(null)
  const [records, setRecords] = useState<WalkRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [message, setMessage] = useState('出発地・到着地を選んでスタート！')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [goalRadius, setGoalRadius] = useState(90)

  const watchId = useRef<number | null>(null)
  const lastStepAt = useRef(0)
  const motionStepCount = useRef(0)
  const accelHistory = useRef<number[]>([])
  const lastPoint = useRef<Point | null>(null)
  const timerRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const liveRef = useRef({ steps, seconds, meters, path, startText, goalText, records })
  liveRef.current = { steps, seconds, meters, path, startText, goalText, records }

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(records))
  }, [records])

  useEffect(() => {
    if (phase === 'walking') {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000)
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [phase])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage('位置情報に対応していません')
      return
    }
    setBusy(true)
    setMessage('現在地を探しています…')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setHere(p)
        setStartText('現在地')
        setMessage('現在地を取得しました')
        setBusy(false)
      },
      () => {
        setMessage('現在地を取得できませんでした')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    )
  }, [])

  const geocode = async (query: string): Promise<Point | null> => {
    const q = query.trim()
    if (!q || q === '現在地') return here
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      )
      const data = await res.json()
      if (!data[0]) return null
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
    } catch {
      return null
    }
  }

  const stopGps = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  const finishWalk = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    stopGps()

    const current = liveRef.current
    const sameRouteRecords = current.records.filter(r => r.to === current.goalText && r.seconds > 0)
    const prevBest = sameRouteRecords.length
      ? Math.min(...sameRouteRecords.map(r => r.seconds))
      : current.records.length
      ? Math.min(...current.records.map(r => r.seconds))
      : null

    if (prevBest !== null && current.seconds > 0 && current.seconds < prevBest) {
      setRecordUpdateDiff(prevBest - current.seconds)
    } else if (prevBest === null && current.seconds > 0) {
      setRecordUpdateDiff(0)
    } else {
      setRecordUpdateDiff(null)
    }

    setRecords(old => [
      {
        id: String(Date.now()),
        date: new Date().toISOString(),
        from: current.startText,
        to: current.goalText,
        steps: current.steps,
        seconds: current.seconds,
        distance: current.meters,
        path: current.path
      },
      ...old
    ])
    setPhase('result')
    setMessage('測量完了！おつかれさまでした')
  }, [])

  const beginWalk = async () => {
    if (!navigator.geolocation) {
      setMessage('GPSに対応していません')
      return
    }
    setBusy(true)
    const dest = await geocode(goalText)
    if (!dest) {
      setMessage('目的地が見つかりません')
      setBusy(false)
      return
    }
    setDestination(dest)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setHere(p)
        setPath([p])
        lastPoint.current = p
        setMeters(0)
        setSteps(0)
        motionStepCount.current = 0
        setSeconds(0)
        setRecordUpdateDiff(null)
        finishedRef.current = false
        setPhase('walking')
        setTab('home')
        setBusy(false)
        setMessage('測量開始！目的地へ進もう')

        watchId.current = navigator.geolocation.watchPosition(
          next => {
            const np = { lat: next.coords.latitude, lng: next.coords.longitude }
            setHere(np)
            const prev = lastPoint.current
            if (prev) {
              const d = distance(prev, np)
              if (d > 2 && d < 80) {
                setMeters(v => v + d)
                setPath(old => [...old, np])
              }
            }
            lastPoint.current = np
            if (distance(np, dest) <= goalRadius) finishWalk()
          },
          () => setMessage('GPS信号を確認中…'),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
        )
      },
      () => {
        setMessage('位置情報の許可が必要です')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const pauseWalk = () => {
    stopGps()
    setPhase('paused')
    setMessage('お団子屋で休憩中。再開ボタンで再スタート！')
  }

  const resumeWalk = () => {
    if (!navigator.geolocation) return
    setPhase('walking')
    setMessage('測量再開！')
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setHere(p)
        const prev = lastPoint.current
        if (prev) {
          const d = distance(prev, p)
          if (d > 2 && d < 80) {
            setMeters(v => v + d)
            setPath(old => [...old, p])
          }
        }
        lastPoint.current = p
        if (destination && distance(p, destination) <= goalRadius) finishWalk()
      },
      () => setMessage('GPS信号を確認中…'),
      { enableHighAccuracy: true, maximumAge: 1000 }
    )
  }

  const resetWalk = () => {
    stopGps()
    finishedRef.current = false
    setPhase('idle')
    setPath([])
    setSeconds(0)
    setSteps(0)
    setMeters(0)
    setDestination(null)
    setRecordUpdateDiff(null)
    setMessage('次の測量の準備ができました')
  }

  useEffect(() => {
    if (phase !== 'walking') return
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity
      if (!a) return
      const magnitude = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2)
      const now = Date.now()
      accelHistory.current.push(magnitude)
      if (accelHistory.current.length > 5) accelHistory.current.shift()
      const avg = accelHistory.current.reduce((x, y) => x + y, 0) / accelHistory.current.length
      if (Math.abs(magnitude - avg) > 1.15 && now - lastStepAt.current > 330) {
        lastStepAt.current = now
        motionStepCount.current += 1
        setSteps(motionStepCount.current)
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [phase])

  const recordsSorted = useMemo(
    () => records.slice().sort((a, b) => a.seconds - b.seconds),
    [records]
  )
  const best = recordsSorted[0]
  const mood: MascotMood =
    phase === 'result'
      ? 'happy'
      : phase === 'walking'
      ? 'walk'
      : phase === 'paused'
      ? 'dango'
      : 'idle'
  const showStats = phase === 'walking' || phase === 'paused'

  const navBearing = useMemo(() => {
    if (!destination) return null
    const dLng = ((destination.lng - here.lng) * Math.PI) / 180
    const lat1 = (here.lat * Math.PI) / 180
    const lat2 = (destination.lat * Math.PI) / 180
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    let brng = (Math.atan2(y, x) * 180) / Math.PI
    brng = (brng + 360) % 360
    const dirs = [
      '北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
      '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'
    ]
    return dirs[Math.round(brng / 22.5) % 16]
  }, [here, destination])

  const remainingDist = destination ? distance(here, destination) : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            setTab('home')
            setMenuOpen(false)
          }}
        >
          <span className="brand-scroll">巻</span>
          <span>
            <strong>いのたび</strong>
            <small>～伊能忠敬と日本地図をつくろう～</small>
          </span>
        </button>

        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="メニュー"
        >
          <Menu size={22} />
        </button>
      </header>

      {menuOpen && (
        <div className="menu-popover">
          <button
            type="button"
            onClick={() => {
              setTab('home')
              setMenuOpen(false)
            }}
          >
            <Home size={17} /> ホーム画面
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('records')
              setMenuOpen(false)
            }}
          >
            <Trophy size={17} /> 過去の記録
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('map')
              setMenuOpen(false)
            }}
          >
            <MapIcon size={17} /> 自分の日本地図
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('settings')
              setMenuOpen(false)
            }}
          >
            <Settings size={17} /> 設定
          </button>
        </div>
      )}

      <main className="main-content">
        {tab === 'home' && (
          <>
            <section className="route-panel">
              {!showStats ? (
                <>
                  <label className="route-field">
                    <span>
                      <MapPin size={14} /> 出発地
                    </span>
                    <input
                      value={startText}
                      onChange={e => setStartText(e.target.value)}
                      placeholder="現在地・駅名"
                    />
                  </label>
                  <label className="route-field">
                    <span>
                      <Flag size={14} /> 到着地
                    </span>
                    <input
                      value={goalText}
                      onChange={e => setGoalText(e.target.value)}
                      placeholder="目的地を入力"
                    />
                  </label>
                  <button type="button" className="locate-button" onClick={locate} disabled={busy}>
                    <LocateFixed size={14} />
                    {busy ? '取得中' : '現在地'}
                  </button>
                </>
              ) : (
                <>
                  <div className="stat">
                    <Clock3 size={18} />
                    <div>
                      <span>経過時間</span>
                      <strong>{fmtTime(seconds)}</strong>
                    </div>
                  </div>
                  <div className="stat">
                    <Footprints size={18} />
                    <div>
                      <span>歩数</span>
                      <strong>
                        {steps.toLocaleString()} <small>歩</small>
                      </strong>
                    </div>
                  </div>
                  <div className="stat">
                    <Route size={18} />
                    <div>
                      <span>距離</span>
                      <strong>{formatKm(meters)}</strong>
                    </div>
                  </div>
                </>
              )}
            </section>

            {showStats && destination && (
              <div className="nav-guidance-bar">
                <Navigation size={15} className="nav-icon" />
                <span>
                  目的地 <strong>{goalText}</strong> まで{' '}
                  <strong>{formatKm(remainingDist || 0)}</strong> （方向：
                  <strong>{navBearing}</strong>）
                </span>
              </div>
            )}

            <section className="map-section">
              <MapContainer
                center={[here.lat, here.lng]}
                zoom={15}
                scrollWheelZoom={false}
                className="leaflet-map"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Recenter point={here} />
                <Circle
                  center={[here.lat, here.lng]}
                  radius={25}
                  pathOptions={{ color: '#4d91e8', fillColor: '#75b5ff', fillOpacity: 0.2 }}
                />
                <Marker position={[here.lat, here.lng]} icon={dotIcon('blue', '●')} />
                {destination && (
                  <Marker position={[destination.lat, destination.lng]} icon={dotIcon('pink', '⚑')} />
                )}
                {path.length > 1 && (
                  <Polyline
                    positions={path.map(p => [p.lat, p.lng] as LatLngExpression)}
                    pathOptions={{ color: '#287de4', weight: 5, opacity: 0.9 }}
                  />
                )}
              </MapContainer>
              <button type="button" className="map-locate" onClick={locate} title="現在地へ">
                <LocateFixed size={16} />
              </button>
            </section>

            <div className="mascot-dock">
              <EdoStage mood={mood} />
            </div>

            <section className="action-area">
              {phase === 'idle' && (
                <button type="button" className="primary-button" onClick={beginWalk} disabled={busy}>
                  <Play fill="currentColor" size={17} /> {busy ? '準備中…' : '測量スタート'}
                </button>
              )}

              {phase === 'walking' && (
                <div className="action-row">
                  <button type="button" className="pause-button" onClick={pauseWalk}>
                    <Pause fill="currentColor" size={15} /> 休憩する
                  </button>
                  <button type="button" className="stop-button" onClick={finishWalk}>
                    <Square fill="currentColor" size={15} /> ゴール
                  </button>
                </div>
              )}

              {phase === 'paused' && (
                <div className="action-row">
                  <button type="button" className="primary-button" onClick={resumeWalk}>
                    <Play fill="currentColor" size={15} /> 再開する
                  </button>
                  <button type="button" className="stop-button" onClick={finishWalk}>
                    <Square fill="currentColor" size={15} /> ゴール
                  </button>
                </div>
              )}

              {phase === 'result' && (
                <div className="result-card">
                  <div className="goal-ribbon">ゴール！</div>
                  <div className="result-stats">
                    <div className="result-row">
                      <span>
                        <Clock3 size={15} color="#e86e8a" /> 所要時間
                      </span>
                      <strong>{fmtTime(seconds)}</strong>
                    </div>
                    <div className="result-row">
                      <span>
                        <Footprints size={15} color="#438ee0" /> 歩数
                      </span>
                      <strong>{steps.toLocaleString()} 歩</strong>
                    </div>
                    <div className="result-row">
                      <span>
                        <MapPin size={15} color="#58b06c" /> 移動距離
                      </span>
                      <strong>{formatKm(meters)}</strong>
                    </div>
                  </div>

                  {recordUpdateDiff !== null && (
                    <div className="record-badge">
                      <strong>👑 新記録更新！</strong>
                      <span>
                        {recordUpdateDiff > 0
                          ? `前回より ${fmtDiff(recordUpdateDiff)} 速い！`
                          : '初記録達成！'}
                      </span>
                    </div>
                  )}

                  <div className="action-row">
                    <button type="button" className="primary-button" onClick={resetWalk}>
                      <RotateCcw size={15} /> つづけて歩く
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setTab('records')}
                    >
                      記録一覧
                    </button>
                  </div>
                </div>
              )}
              <p className="status-message">{message}</p>
            </section>
          </>
        )}

        {tab === 'records' && (
          <section className="page-card">
            <div className="page-title">
              <Trophy size={22} />
              <div>
                <h2>測量の記録</h2>
                <p>歩いた旅の思い出と最速タイム</p>
              </div>
            </div>
            {records.length === 0 ? (
              <div className="empty-state">
                <p>まだ記録がありません。測量に出かけよう！</p>
                <button type="button" className="primary-button" onClick={() => setTab('home')}>
                  ホームへ
                </button>
              </div>
            ) : (
              <div className="record-list">
                {records.map((r, i) => (
                  <article className="record-item" key={r.id}>
                    <div className="record-rank">{i === 0 ? '👑' : `${i + 1}`}</div>
                    <div className="record-body">
                      <strong>
                        {r.from} → {r.to}
                      </strong>
                      <small>{new Date(r.date).toLocaleString('ja-JP')}</small>
                      <div>
                        {fmtTime(r.seconds)} ・ {r.steps.toLocaleString()}歩 ・{' '}
                        {formatKm(r.distance)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setRecords(old => old.filter(x => x.id !== r.id))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            {best && (
              <div className="best-box">
                <Award size={18} />
                <span>最速記録</span>
                <strong>{fmtTime(best.seconds)}</strong>
              </div>
            )}
          </section>
        )}

        {tab === 'map' && (
          <section className="page-card">
            <div className="page-title">
              <MapIcon size={22} />
              <div>
                <h2>自分だけの日本地図</h2>
                <p>過去に歩いたすべてのルートがここに蓄積されます</p>
              </div>
            </div>
            <div className="map-preview">
              <MapContainer
                center={[here.lat, here.lng]}
                zoom={13}
                className="leaflet-map"
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {records.map(
                  r =>
                    r.path.length > 1 && (
                      <Polyline
                        key={r.id}
                        positions={r.path.map(p => [p.lat, p.lng] as LatLngExpression)}
                        pathOptions={{ color: '#e77b9b', weight: 4.5, opacity: 0.85 }}
                      />
                    )
                )}
              </MapContainer>
            </div>
          </section>
        )}

        {tab === 'settings' && (
          <section className="page-card">
            <div className="page-title">
              <Settings size={22} />
              <div>
                <h2>設定</h2>
                <p>アプリの動作設定</p>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <strong>現在地・GPS</strong>
                <small>ルート記録に使用</small>
              </div>
              <button type="button" className="outline-button" onClick={locate}>
                確認
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>歩数センサー</strong>
                <small>端末の歩数計測</small>
              </div>
              <button
                type="button"
                className="outline-button"
                onClick={() => {
                  const m = DeviceMotionEvent as unknown as {
                    requestPermission?: () => Promise<string>
                  }
                  if (m.requestPermission) m.requestPermission()
                  else setMessage('対応端末です')
                }}
              >
                許可
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>ゴール判定範囲</strong>
                <small>目的地からの距離</small>
              </div>
              <select value={goalRadius} onChange={e => setGoalRadius(Number(e.target.value))}>
                <option value={50}>50 m</option>
                <option value={90}>90 m</option>
                <option value={150}>150 m</option>
              </select>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}