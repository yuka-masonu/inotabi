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
  Info,
  Award,
  Compass
} from 'lucide-react'
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
const STORE_KEY = 'inotabi-records-v1'

const dotIcon = (color: string, label: string) =>
  L.divIcon({
    className: 'map-dot-wrap',
    html: `<div class="map-dot ${color}">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })

function Recenter({ point }: { point: Point }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 1 })
  }, [point.lat, point.lng, map])
  return null
}

function EdoStage({ mood }: { mood: MascotMood }) {
  const speech =
    mood === 'idle'
      ? 'お茶を一服…出発を待ってるよ！'
      : mood === 'walk'
      ? 'どんどん進みましょう！'
      : mood === 'dango'
      ? 'お団子屋でひと休み♪ 甘いなぁ'
      : '見事に踏破しました！'

  return (
    <div className={`edo-stage stage-${mood}`} aria-label="江戸街道と伊能忠敬のアニメーション">
      {/* 巻物風の左右の軸 */}
      <div className="scroll-rod left" />
      <div className="scroll-rod right" />

      <div className="stage-viewport">
        {/* 遠景の山・富士山（歩行中はゆっくりスクロール） */}
        <div className="bg-layer bg-mountains">
          <svg viewBox="0 0 800 130" preserveAspectRatio="none" className="bg-svg">
            {/* 遠くの山並み */}
            <path
              d="M0 105 Q90 60 180 92 Q260 55 350 95 L350 130 L0 130 Z"
              fill="#b9cfa9"
            />
            <path
              d="M400 105 Q490 60 580 92 Q660 55 750 95 L800 105 L800 130 L400 130 Z"
              fill="#b9cfa9"
            />
            {/* 富士山 */}
            <path d="M230 105 L295 36 L360 105 Z" fill="#8ca8be" />
            <path d="M276 56 L295 36 L314 56 L305 62 L295 54 L285 62 Z" fill="#ffffff" />
            <path d="M630 105 L695 36 L760 105 Z" fill="#8ca8be" />
            <path d="M676 56 L695 36 L714 56 L705 62 L695 54 L685 62 Z" fill="#ffffff" />
          </svg>
        </div>

        {/* 中景の松並木と一里塚（歩行中は流れる） */}
        <div className="bg-layer bg-trees">
          <svg viewBox="0 0 800 130" preserveAspectRatio="none" className="bg-svg">
            {/* 1セット目 */}
            <g transform="translate(65, 28)">
              <path d="M18 76 Q14 48 22 25" stroke="#7a5638" strokeWidth="6" fill="none" strokeLinecap="round" />
              <ellipse cx="22" cy="22" rx="22" ry="10" fill="#5e8c5a" />
              <ellipse cx="10" cy="34" rx="15" ry="7" fill="#6b9c67" />
              <ellipse cx="34" cy="32" rx="16" ry="7" fill="#527d4e" />
            </g>
            {/* 道標 */}
            <g transform="translate(135, 68)">
              <rect x="0" y="0" width="9" height="34" rx="2" fill="#d9c39e" stroke="#856845" strokeWidth="1.5" />
            </g>
            <g transform="translate(320, 32)">
              <path d="M18 72 Q22 46 15 24" stroke="#7a5638" strokeWidth="5.5" fill="none" strokeLinecap="round" />
              <ellipse cx="16" cy="20" rx="20" ry="9" fill="#5e8c5a" />
              <ellipse cx="28" cy="31" rx="14" ry="6.5" fill="#6b9c67" />
            </g>

            {/* 2セット目（ループ用） */}
            <g transform="translate(465, 28)">
              <path d="M18 76 Q14 48 22 25" stroke="#7a5638" strokeWidth="6" fill="none" strokeLinecap="round" />
              <ellipse cx="22" cy="22" rx="22" ry="10" fill="#5e8c5a" />
              <ellipse cx="10" cy="34" rx="15" ry="7" fill="#6b9c67" />
              <ellipse cx="34" cy="32" rx="16" ry="7" fill="#527d4e" />
            </g>
            <g transform="translate(535, 68)">
              <rect x="0" y="0" width="9" height="34" rx="2" fill="#d9c39e" stroke="#856845" strokeWidth="1.5" />
            </g>
            <g transform="translate(720, 32)">
              <path d="M18 72 Q22 46 15 24" stroke="#7a5638" strokeWidth="5.5" fill="none" strokeLinecap="round" />
              <ellipse cx="16" cy="20" rx="20" ry="9" fill="#5e8c5a" />
              <ellipse cx="28" cy="31" rx="14" ry="6.5" fill="#6b9c67" />
            </g>
          </svg>
        </div>

        {/* 街道の地面と流れる小石 */}
        <div className="bg-ground">
          <div className="ground-pebbles" />
        </div>

        {/* 休憩ボタン押下時：お団子屋（茶屋）の背景と縁台 */}
        {mood === 'dango' && (
          <div className="dango-shop" aria-hidden="true">
            <svg viewBox="0 0 260 135" className="dango-svg">
              {/* 茅葺き・瓦風の屋根 */}
              <path d="M10 38 L32 10 L228 10 L250 38 Z" fill="#6e5a4f" stroke="#473830" strokeWidth="2.5" />
              <line x1="14" y1="32" x2="246" y2="32" stroke="#8c7568" strokeWidth="3" />
              {/* 柱 */}
              <rect x="28" y="38" width="9" height="86" fill="#7c5638" stroke="#47301e" strokeWidth="2" />
              <rect x="223" y="38" width="9" height="86" fill="#7c5638" stroke="#47301e" strokeWidth="2" />
              {/* のれん */}
              <rect x="42" y="38" width="42" height="28" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="2" />
              <rect x="88" y="38" width="42" height="28" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="2" />
              <rect x="134" y="38" width="42" height="28" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="2" />
              <rect x="180" y="38" width="40" height="28" rx="2" fill="#3b5e8c" stroke="#243b59" strokeWidth="2" />
              <text x="63" y="57" textAnchor="middle" fill="#fff8e7" fontSize="14" fontWeight="bold">
                だ
              </text>
              <text x="109" y="57" textAnchor="middle" fill="#fff8e7" fontSize="14" fontWeight="bold">
                ん
              </text>
              <text x="155" y="57" textAnchor="middle" fill="#fff8e7" fontSize="14" fontWeight="bold">
                ご
              </text>
              <text x="200" y="57" textAnchor="middle" fill="#fff8e7" fontSize="13" fontWeight="bold">
                茶
              </text>
              {/* 赤い毛氈の縁台 */}
              <rect x="44" y="96" width="172" height="12" rx="3" fill="#d94e4e" stroke="#8a2b2b" strokeWidth="2" />
              <rect x="56" y="108" width="8" height="18" fill="#6b482e" />
              <rect x="196" y="108" width="8" height="18" fill="#6b482e" />
              {/* 縁台の上のお皿とお団子 */}
              <ellipse cx="188" cy="94" rx="16" ry="4" fill="#ffffff" stroke="#8c7b6b" strokeWidth="1.5" />
              <line x1="176" y1="92" x2="202" y2="85" stroke="#b5895a" strokeWidth="2" />
              <circle cx="183" cy="90" r="3.5" fill="#f29bb2" />
              <circle cx="190" cy="88" r="3.5" fill="#fffdf7" />
              <circle cx="197" cy="86" r="3.5" fill="#7db87d" />
            </svg>
          </div>
        )}

        {/* 吹き出し */}
        <div className="stage-speech">{speech}</div>

        {/* 伊能忠敬キャラクター本体 */}
        <div className="inou-character">
          {mood === 'walk' ? (
            /* 歩行中：右に向かって元気に歩く横向きポーズ */
            <svg viewBox="0 0 180 175" className="inou-svg walk-pose">
              <ellipse cx="90" cy="162" rx="38" ry="6" fill="#7a6242" opacity=".25" />

              <g className="walk-body">
                {/* 背中の風呂敷包み */}
                <circle cx="58" cy="96" r="21" fill="#9c7a56" stroke="#4a3525" strokeWidth="2.5" />
                <path d="M45 84 Q58 96 71 108 M71 84 Q58 96 45 108" stroke="#75583b" strokeWidth="2.2" />

                {/* 奥側の腕 */}
                <g className="walk-arm-back">
                  <path d="M98 88 L116 110" stroke="#223e68" strokeWidth="11" strokeLinecap="round" />
                  <circle cx="117" cy="111" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                </g>

                {/* 奥側の脚 */}
                <g className="walk-leg-back">
                  <path
                    d="M84 128 L72 152 L60 154"
                    stroke="#f5cfa6"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <ellipse cx="66" cy="156" rx="12" ry="4.5" fill="#d9a76a" stroke="#5b4436" strokeWidth="2" />
                </g>

                {/* 手前側の脚 */}
                <g className="walk-leg-front">
                  <path
                    d="M94 128 L108 151 L122 153"
                    stroke="#f5cfa6"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <ellipse cx="116" cy="155" rx="12" ry="4.5" fill="#d9a76a" stroke="#5b4436" strokeWidth="2" />
                </g>

                {/* 着物（右向き） */}
                <path
                  d="M70 76 Q62 104 68 134 L114 134 Q118 104 106 76 Z"
                  fill="#2b4c7e"
                  stroke="#1b3254"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {/* 襟元 */}
                <path d="M94 76 L108 98 L105 76 Z" fill="#fff7e8" />
                <path d="M92 76 L109 101" stroke="#1b3254" strokeWidth="2.8" strokeLinecap="round" />
                {/* 帯 */}
                <rect x="67" y="108" width="48" height="10" rx="3" fill="#a8845c" stroke="#4a3525" strokeWidth="2" />

                {/* 手前側の腕＋測量杖 */}
                <g className="walk-arm-front">
                  <path d="M86 88 L104 108" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" />
                  <line
                    x1="112"
                    y1="66"
                    x2="106"
                    y2="160"
                    stroke="#8a5a36"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <circle cx="106" cy="109" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                </g>

                {/* 頭部（右向き笑顔） */}
                <g className="walk-head">
                  {/* ちょんまげ */}
                  <path
                    d="M74 22 Q72 6 86 9 Q96 12 90 24"
                    fill="#362620"
                    stroke="#241814"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* 髪（後ろ側） */}
                  <path
                    d="M52 54 Q48 24 78 20 Q112 18 124 44 Q130 68 112 86 Q86 94 64 84 Q50 74 52 54Z"
                    fill="#362620"
                  />
                  {/* 顔輪郭 */}
                  <ellipse cx="92" cy="56" rx="35" ry="34" fill="#f5cfa6" stroke="#362620" strokeWidth="2.8" />
                  {/* 髪と月代 */}
                  <path
                    d="M57 56 Q55 26 84 22 Q108 20 122 38 Q106 34 94 38 Q76 42 66 64 Q58 64 57 56Z"
                    fill="#362620"
                  />
                  <path d="M84 23 Q104 21 116 32 Q104 37 90 36 Z" fill="#f5cfa6" />

                  {/* 眉・にっこり目・ほっぺ・笑顔 */}
                  <path d="M98 44 Q104 40 110 43" fill="none" stroke="#362620" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M98 54 Q104 47 110 54" fill="none" stroke="#362620" strokeWidth="2.8" strokeLinecap="round" />
                  <ellipse cx="92" cy="64" rx="6.5" ry="3.8" fill="#f08c82" opacity=".65" />
                  <path
                    d="M104 66 Q112 75 117 65 Z"
                    fill="#e06666"
                    stroke="#362620"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            </svg>
          ) : (
            /* 待機中（お茶）・お団子屋休憩中・ゴール時の正面ポーズ */
            <svg viewBox="0 0 200 175" className="inou-svg front-pose">
              <ellipse className="front-shadow" cx="100" cy="162" rx="48" ry="7" fill="#7a6242" opacity=".22" />

              <g className="front-body">
                {/* 脚・座り姿勢 */}
                {mood === 'happy' ? (
                  <g>
                    <path
                      d="M84 128 L78 150 L66 153"
                      stroke="#f5cfa6"
                      strokeWidth="10"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <ellipse cx="70" cy="155" rx="12" ry="4.5" fill="#d9a76a" stroke="#5b4436" strokeWidth="2" />
                    <path
                      d="M116 128 L122 150 L134 153"
                      stroke="#f5cfa6"
                      strokeWidth="10"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <ellipse cx="130" cy="155" rx="12" ry="4.5" fill="#d9a76a" stroke="#5b4436" strokeWidth="2" />
                  </g>
                ) : (
                  <g>
                    <path
                      d="M64 134 Q100 142 136 134 Q142 150 124 154 L76 154 Q58 150 64 134Z"
                      fill="#233b5d"
                      stroke="#182942"
                      strokeWidth="2.4"
                    />
                    <ellipse cx="80" cy="154" rx="11" ry="4.5" fill="#e8c396" stroke="#5b4436" strokeWidth="1.8" />
                    <ellipse cx="120" cy="154" rx="11" ry="4.5" fill="#e8c396" stroke="#5b4436" strokeWidth="1.8" />
                  </g>
                )}

                {/* 着物 */}
                <path
                  d="M70 82 Q56 106 64 136 L136 136 Q144 106 130 82 Z"
                  fill="#2b4c7e"
                  stroke="#1b3254"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path d="M88 82 L100 106 L112 82 Z" fill="#fff7e8" />
                <path d="M86 82 L100 109 L114 82" fill="none" stroke="#1b3254" strokeWidth="2.6" />
                <rect x="68" y="112" width="64" height="10" rx="3" fill="#9c7a54" stroke="#4a3525" strokeWidth="2" />

                {/* 状態別の腕と持ち物 */}
                {mood === 'idle' && (
                  <g>
                    <path d="M70 92 Q56 110 72 120" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" fill="none" />
                    <circle cx="74" cy="121" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                    <g className="sip-arm">
                      <path d="M130 92 Q142 106 122 108" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" fill="none" />
                      <circle cx="119" cy="107" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                      <path d="M110 95 L124 95 L122 109 Q117 111 112 109 Z" fill="#7da87b" stroke="#3b593a" strokeWidth="1.8" />
                      <path className="steam-line" d="M115 90 Q112 84 116 79" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </g>
                  </g>
                )}

                {mood === 'dango' && (
                  <g>
                    {/* 左手：三色団子 */}
                    <g className="dango-arm">
                      <path d="M70 92 Q54 104 74 104" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" fill="none" />
                      <circle cx="76" cy="104" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                      <line x1="74" y1="108" x2="86" y2="76" stroke="#b5895a" strokeWidth="2.4" strokeLinecap="round" />
                      <circle cx="79" cy="95" r="4.8" fill="#7db87d" stroke="#3b593a" strokeWidth="1.4" />
                      <circle cx="82" cy="86" r="4.8" fill="#fffdf7" stroke="#8c7b6b" strokeWidth="1.4" />
                      <circle cx="85" cy="77" r="4.8" fill="#f29bb2" stroke="#9e4d63" strokeWidth="1.4" />
                    </g>
                    {/* 右手：お茶 */}
                    <g className="sip-arm">
                      <path d="M130 92 Q144 106 124 108" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" fill="none" />
                      <circle cx="121" cy="107" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                      <path d="M112 95 L126 95 L124 109 Q119 111 114 109 Z" fill="#7da87b" stroke="#3b593a" strokeWidth="1.8" />
                    </g>
                  </g>
                )}

                {mood === 'happy' && (
                  <g>
                    <g className="happy-left">
                      <path d="M70 88 L48 66" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" />
                      <g transform="rotate(-20 44 58)">
                        <rect x="36" y="38" width="15" height="40" rx="4" fill="#f4dfad" stroke="#8a6139" strokeWidth="2" />
                      </g>
                      <circle cx="48" cy="65" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                    </g>
                    <g className="happy-right">
                      <path d="M130 88 L152 64" stroke="#2b4c7e" strokeWidth="11" strokeLinecap="round" />
                      <circle cx="152" cy="63" r="6" fill="#f5cfa6" stroke="#362620" strokeWidth="2" />
                    </g>
                  </g>
                )}

                {/* 頭部（正面） */}
                <g>
                  <path
                    d="M93 18 Q95 3 107 6 Q115 9 109 21"
                    fill="#362620"
                    stroke="#241814"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M60 50 Q56 24 84 18 Q122 14 136 40 Q145 64 130 86 Q114 98 86 94 Q60 88 60 50Z"
                    fill="#362620"
                  />
                  <ellipse cx="100" cy="56" rx="37" ry="35" fill="#f5cfa6" stroke="#362620" strokeWidth="2.8" />
                  <path
                    d="M63 52 Q61 26 85 21 Q100 19 115 21 Q138 26 137 52 Q128 39 116 36 Q100 42 84 36 Q72 39 63 52Z"
                    fill="#362620"
                  />
                  <path d="M80 23 Q100 18 120 23 Q114 35 100 36 Q86 35 80 23Z" fill="#f5cfa6" />

                  <path d="M79 47 Q86 43 92 46" fill="none" stroke="#362620" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M108 46 Q114 43 121 47" fill="none" stroke="#362620" strokeWidth="2.4" strokeLinecap="round" />

                  {mood === 'happy' ? (
                    <>
                      <path d="M79 59 Q86 51 92 59" fill="none" stroke="#362620" strokeWidth="2.8" strokeLinecap="round" />
                      <path d="M108 59 Q114 51 121 59" fill="none" stroke="#362620" strokeWidth="2.8" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <path d="M79 58 Q86 63 92 58" fill="none" stroke="#362620" strokeWidth="2.6" strokeLinecap="round" />
                      <path d="M108 58 Q114 63 121 58" fill="none" stroke="#362620" strokeWidth="2.6" strokeLinecap="round" />
                    </>
                  )}

                  <ellipse cx="74" cy="66" rx="6.5" ry="3.8" fill="#f08c82" opacity=".65" />
                  <ellipse cx="126" cy="66" rx="6.5" ry="3.8" fill="#f08c82" opacity=".65" />

                  {mood === 'happy' ? (
                    <path
                      d="M92 71 Q100 83 108 71 Z"
                      fill="#e06666"
                      stroke="#362620"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <path d="M93 72 Q100 79 107 72" fill="none" stroke="#362620" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                </g>
              </g>

              {mood === 'happy' && (
                <g className="sparkles">
                  <path d="M28 32 L31 40 L39 43 L31 46 L28 54 L25 46 L17 43 L25 40Z" fill="#ffd24c" />
                  <path d="M172 34 L175 41 L182 44 L175 47 L172 54 L169 47 L162 44 L169 41Z" fill="#ff8ba8" />
                </g>
              )}
            </svg>
          )}
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
  const [message, setMessage] = useState('出発地と到着地を選んで「スタート」を押してね')
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
      setMessage('このブラウザは位置情報に対応していません')
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
      err => {
        setMessage(
          err.code === 1 ? '位置情報の使用を許可してください' : '現在地を取得できませんでした'
        )
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
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
    setMessage('おつかれさま！測量完了です')
  }, [])

  const beginWalk = async () => {
    if (!navigator.geolocation) {
      setMessage('GPSに対応したブラウザで開いてください')
      return
    }
    setBusy(true)
    const dest = await geocode(goalText)
    if (!dest) {
      setMessage('目的地が見つかりません。駅名や地名を変えてみてね')
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
        setMessage('測量開始！目的地まで気をつけて歩こう')

        watchId.current = navigator.geolocation.watchPosition(
          next => {
            const np = { lat: next.coords.latitude, lng: next.coords.longitude }
            setHere(np)
            const prev = lastPoint.current
            if (prev) {
              const d = distance(prev, np)
              if (d > 2.5 && d < 80) {
                setMeters(v => v + d)
                setPath(old => [...old, np])
              }
            }
            lastPoint.current = np
            if (distance(np, dest) <= goalRadius) finishWalk()
          },
          () => setMessage('GPS信号が弱いようです。空の開けた場所でお試しください'),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
        )
      },
      () => {
        setMessage('位置情報を許可してください')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const pauseWalk = () => {
    stopGps()
    setPhase('paused')
    setMessage('お団子屋さんでひと休み中。再開ボタンで続きから歩けるよ')
  }

  const resumeWalk = () => {
    if (!navigator.geolocation) return
    setPhase('walking')
    setMessage('測量を再開しました！')
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setHere(p)
        const prev = lastPoint.current
        if (prev) {
          const d = distance(prev, p)
          if (d > 2.5 && d < 80) {
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

  const requestMotion = async () => {
    const motion = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<string>
    }
    if (motion.requestPermission) {
      try {
        const result = await motion.requestPermission()
        setMessage(
          result === 'granted' ? '歩数センサーを有効にしました' : '歩数センサーが許可されませんでした'
        )
      } catch {
        setMessage('歩数センサーを利用できません')
      }
    } else {
      setMessage('対応端末では歩数センサーを利用できます')
    }
  }

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
          <Menu />
        </button>
      </header>

      {menuOpen && (
        <div className="menu-popover">
          <button
            type="button"
            onClick={() => {
              setTab('records')
              setMenuOpen(false)
            }}
          >
            <Trophy size={18} /> 過去の記録
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('map')
              setMenuOpen(false)
            }}
          >
            <MapIcon size={18} /> 測量した地図
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('settings')
              setMenuOpen(false)
            }}
          >
            <Settings size={18} /> 設定
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
                      <MapPin /> 出発地
                    </span>
                    <input
                      value={startText}
                      onChange={e => setStartText(e.target.value)}
                      placeholder="現在地・駅名・地名"
                    />
                  </label>
                  <label className="route-field">
                    <span>
                      <Flag /> 到着地
                    </span>
                    <input
                      value={goalText}
                      onChange={e => setGoalText(e.target.value)}
                      placeholder="駅名・地名を入力"
                    />
                  </label>
                  <button type="button" className="locate-button" onClick={locate} disabled={busy}>
                    <LocateFixed size={16} />
                    {busy ? '取得中' : '現在地'}
                  </button>
                </>
              ) : (
                <>
                  <div className="stat">
                    <Clock3 />
                    <span>
                      経過時間<strong>{fmtTime(seconds)}</strong>
                    </span>
                  </div>
                  <div className="stat">
                    <Footprints />
                    <span>
                      歩数
                      <strong>
                        {steps.toLocaleString()} <small>歩</small>
                      </strong>
                    </span>
                  </div>
                  <div className="stat">
                    <Route />
                    <span>
                      移動距離<strong>{formatKm(meters)}</strong>
                    </span>
                  </div>
                </>
              )}
            </section>

            <section className="map-section">
              <MapContainer
                center={[here.lat, here.lng]}
                zoom={15}
                scrollWheelZoom
                className="leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Recenter point={here} />
                <Circle
                  center={[here.lat, here.lng]}
                  radius={25}
                  pathOptions={{ color: '#4d91e8', fillColor: '#75b5ff', fillOpacity: 0.22 }}
                />
                <Marker position={[here.lat, here.lng]} icon={dotIcon('blue', '●')} />
                {destination && (
                  <Marker position={[destination.lat, destination.lng]} icon={dotIcon('pink', '⚑')} />
                )}
                {path.length > 1 && (
                  <Polyline
                    positions={path.map(p => [p.lat, p.lng] as LatLngExpression)}
                    pathOptions={{ color: '#287de4', weight: 6, opacity: 0.9 }}
                  />
                )}
              </MapContainer>
              <button type="button" className="map-locate" onClick={locate} title="現在地へ移動">
                <LocateFixed size={19} />
              </button>
              <div className="map-hint">
                <Compass size={15} />
                {phase === 'walking'
                  ? '歩いた道を記録しています'
                  : phase === 'paused'
                  ? 'お団子屋さんで休憩中'
                  : '地図を見ながら出発しよう'}
              </div>
            </section>

            <section className="action-area">
              {phase === 'idle' && (
                <button type="button" className="primary-button" onClick={beginWalk} disabled={busy}>
                  <Play fill="currentColor" size={20} /> {busy ? '準備中…' : 'スタート'}
                </button>
              )}

              {phase === 'walking' && (
                <div className="action-row">
                  <button type="button" className="pause-button" onClick={pauseWalk}>
                    <Pause fill="currentColor" size={18} /> 休憩する
                  </button>
                  <button type="button" className="stop-button" onClick={finishWalk}>
                    <Square fill="currentColor" size={18} /> ゴール
                  </button>
                </div>
              )}

              {phase === 'paused' && (
                <div className="action-row">
                  <button type="button" className="primary-button" onClick={resumeWalk}>
                    <Play fill="currentColor" size={18} /> 再開する
                  </button>
                  <button type="button" className="stop-button" onClick={finishWalk}>
                    <Square fill="currentColor" size={18} /> ゴール
                  </button>
                </div>
              )}

              {phase === 'result' && (
                <div className="result-card">
                  <div className="goal-ribbon">ゴール！</div>
                  <div className="result-stats">
                    <div className="result-row">
                      <span>
                        <Clock3 size={17} color="#e86e8a" /> 所要時間
                      </span>
                      <strong>{fmtTime(seconds)}</strong>
                    </div>
                    <div className="result-row">
                      <span>
                        <Footprints size={17} color="#438ee0" /> 歩数
                      </span>
                      <strong>{steps.toLocaleString()} 歩</strong>
                    </div>
                    <div className="result-row">
                      <span>
                        <MapPin size={17} color="#58b06c" /> 移動距離
                      </span>
                      <strong>{formatKm(meters)}</strong>
                    </div>
                  </div>

                  {recordUpdateDiff !== null && (
                    <div className="record-badge">
                      <strong>👑 新記録！</strong>
                      <span>
                        {recordUpdateDiff > 0
                          ? `前回より ${fmtDiff(recordUpdateDiff)} 更新`
                          : '記念すべき初記録を達成！'}
                      </span>
                    </div>
                  )}

                  <div className="action-row">
                    <button type="button" className="primary-button" onClick={resetWalk}>
                      <RotateCcw size={18} /> つづけて歩く
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setTab('records')}>
                      記録一覧へ
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
              <Trophy />
              <div>
                <h2>測量の記録</h2>
                <p>歩いた旅の思い出と最速タイムが残るよ</p>
              </div>
            </div>
            {records.length === 0 ? (
              <div className="empty-state">
                <p>まだ記録がないよ。最初の測量に出かけよう！</p>
                <button type="button" className="primary-button" onClick={() => setTab('home')}>
                  出発する
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
                        {fmtTime(r.seconds)} ・ {r.steps.toLocaleString()}歩 ・ 
                        {formatKm(r.distance)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      title="この記録を削除"
                      onClick={() => setRecords(old => old.filter(x => x.id !== r.id))}
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                ))}
              </div>
            )}
            {best && (
              <div className="best-box">
                <Award />
                <span>最速記録</span>
                <strong>{fmtTime(best.seconds)}</strong>
              </div>
            )}
          </section>
        )}

        {tab === 'map' && (
          <section className="page-card">
            <div className="page-title">
              <MapIcon />
              <div>
                <h2>自分だけの日本地図</h2>
                <p>これまでに歩いた道のりがピンクの線で刻まれるよ</p>
              </div>
            </div>
            <div className="map-preview">
              <MapContainer center={[here.lat, here.lng]} zoom={13} className="leaflet-map">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {records.map(
                  r =>
                    r.path.length > 1 && (
                      <Polyline
                        key={r.id}
                        positions={r.path.map(p => [p.lat, p.lng] as LatLngExpression)}
                        pathOptions={{ color: '#e77b9b', weight: 5, opacity: 0.8 }}
                      />
                    )
                )}
              </MapContainer>
            </div>
            <p className="map-note">
              記録した {records.length} 回分のルートを表示しています。歩いて地図を埋めよう！
            </p>
          </section>
        )}

        {tab === 'settings' && (
          <section className="page-card">
            <div className="page-title">
              <Settings />
              <div>
                <h2>設定</h2>
                <p>測量を快適に楽しむための設定</p>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <strong>現在地・GPS</strong>
                <small>地図と移動ルートの記録に使用します</small>
              </div>
              <button type="button" className="outline-button" onClick={locate}>
                位置情報を確認
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>歩数センサー</strong>
                <small>端末の動作センサー利用をリクエストします</small>
              </div>
              <button type="button" className="outline-button" onClick={requestMotion}>
                許可を確認
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>ゴール判定の範囲</strong>
                <small>目的地からこの距離以内で自動的にゴールします</small>
              </div>
              <select value={goalRadius} onChange={e => setGoalRadius(Number(e.target.value))}>
                <option value={50}>50 m</option>
                <option value={90}>90 m</option>
                <option value={150}>150 m</option>
                <option value={250}>250 m</option>
              </select>
            </div>
            <div className="notice">
              <Info size={18} />
              GPSと歩数センサーはHTTPS環境での利用を推奨します。歩数センサー非対応端末では歩数が正確に取得できない場合があります。
            </div>
          </section>
        )}
      </main>

      {/* 画面下部・ナビゲーションの上に固定表示される江戸街道＋伊能忠敬 */}
      <div className="mascot-dock">
        <EdoStage mood={mood} />
      </div>

      <nav className="bottom-nav" aria-label="メインナビゲーション">
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <Home />
          <span>ホーム</span>
        </button>
        <button type="button" className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>
          <Trophy />
          <span>記録</span>
        </button>
        <button type="button" className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>
          <MapIcon />
          <span>マップ</span>
        </button>
        <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <Settings />
          <span>設定</span>
        </button>
      </nav>
    </div>
  )
}