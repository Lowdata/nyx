'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpinWin: (pts: number) => void;
  remainingMs: number;
}

export interface WheelSector {
  id: string;
  label: string;
  sublabel: string;
  points: number;
  isWhitelist?: boolean;
  gradient: [string, string];
  textColor: string;
  icon: string;
  weight: number; // Selection weight among non-whitelist items
}

// 8 Sectors: Whitelist is at Sector 0 with 0% win weight (NEVER won)
const SECTORS: WheelSector[] = [
  {
    id: 'whitelist',
    label: 'WHITELIST',
    sublabel: 'MYTHIC',
    points: 0,
    isWhitelist: true,
    gradient: ['#ffd700', '#df9510'],
    textColor: '#120d04',
    icon: '⭐',
    weight: 0, // RIGGED: ZERO WEIGHT, CAN NEVER BE WON!
  },
  {
    id: 'pts-50',
    label: '50',
    sublabel: 'PTS',
    points: 50,
    gradient: ['#1c1f42', '#2a2f63'],
    textColor: '#e0e7ff',
    icon: '🌙',
    weight: 30, // Adjacent clockwise to Whitelist (near-miss target)
  },
  {
    id: 'pts-250',
    label: '250',
    sublabel: 'PTS',
    points: 250,
    gradient: ['#28184a', '#432378'],
    textColor: '#f5d0fe',
    icon: '🔮',
    weight: 10,
  },
  {
    id: 'pts-100',
    label: '100',
    sublabel: 'PTS',
    points: 100,
    gradient: ['#14253f', '#1d3b63'],
    textColor: '#bae6fd',
    icon: '✨',
    weight: 22,
  },
  {
    id: 'pts-500',
    label: '500',
    sublabel: 'PTS',
    points: 500,
    gradient: ['#3e163b', '#6b205e'],
    textColor: '#fbcfe8',
    icon: '👑',
    weight: 4, // Mythic point jackpot
  },
  {
    id: 'pts-75',
    label: '75',
    sublabel: 'PTS',
    points: 75,
    gradient: ['#132c38', '#1f485c'],
    textColor: '#a7f3d0',
    icon: '⚡',
    weight: 18,
  },
  {
    id: 'pts-200',
    label: '200',
    sublabel: 'PTS',
    points: 200,
    gradient: ['#281d47', '#422d72'],
    textColor: '#ddd6fe',
    icon: '💎',
    weight: 10,
  },
  {
    id: 'pts-150',
    label: '150',
    sublabel: 'PTS',
    points: 150,
    gradient: ['#192344', '#283769'],
    textColor: '#e2e8f0',
    icon: '🌟',
    weight: 20, // Adjacent counter-clockwise to Whitelist (near-miss target)
  },
];

function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Synthesized audio helper for tactile mechanical ticker & win chimes
class WebAudioEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        this.ctx = new AudioClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTick(pitchOffset = 0) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650 + pitchOffset, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {}
  }

  playWin(isSpecial: boolean) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = isSpecial
        ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
        : [440.0, 554.37, 659.25]; // A4, C#5, E5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.12, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.6);
      });
    } catch {}
  }
}

const audio = new WebAudioEngine();

export default function SpinModal({
  isOpen,
  onClose,
  onSpinWin,
  remainingMs,
}: SpinModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [tickerFlick, setTickerFlick] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [resultData, setResultData] = useState<{
    sector: WheelSector;
    isNearMiss: boolean;
  } | null>(null);

  const tickerTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Keep audio setting synced
  useEffect(() => {
    audio.soundEnabled = soundOn;
  }, [soundOn]);

  // Clean up any pending ticker audio timeouts
  const clearTimers = useCallback(() => {
    tickerTimerRef.current.forEach((t) => clearTimeout(t));
    tickerTimerRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSpinning) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSpinning, onClose]);

  // Select winning sector: GUARANTEED NEVER TO BE WHITELIST
  const pickTargetSector = (): { sector: WheelSector; index: number; isNearMiss: boolean } => {
    // Sector 0 is Whitelist. Eligible sectors are indices 1..7.
    const eligible = SECTORS.map((s, idx) => ({ sector: s, index: idx })).filter(
      (item) => !item.sector.isWhitelist
    );

    const totalWeight = eligible.reduce((acc, curr) => acc + curr.sector.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = eligible[0];

    for (const item of eligible) {
      if (rand < item.sector.weight) {
        chosen = item;
        break;
      }
      rand -= item.sector.weight;
    }

    // Near miss is when landing on sector 1 (50 PTS) or sector 7 (150 PTS) right next to Whitelist!
    const isNearMiss = chosen.index === 1 || chosen.index === 7;
    return { ...chosen, isNearMiss };
  };

  const handleSpin = () => {
    if (remainingMs > 0 || isSpinning) return;
    setIsSpinning(true);
    setResultData(null);
    clearTimers();

    const { sector, index: targetIndex, isNearMiss } = pickTargetSector();

    // Wheel Geometry Math:
    // 8 sectors, each 45 deg.
    // Sector i starts at i*45 deg, ends at (i+1)*45 deg.
    // Center of sector i is at i*45 + 22.5 deg.
    // Top pointer is at 0 deg (12 o'clock).
    // An element at angle theta moves to (theta + R) mod 360.
    // For sector center to align with pointer (0 deg):
    // (theta + R) mod 360 = 0 => R mod 360 = (360 - theta) mod 360.
    const per = 45;
    const centerAngle = targetIndex * per + per / 2;

    // Jitter calculation:
    // If Near Miss, position needle dramatically near the boundary of Whitelist (0 deg / 45 deg)!
    // Sector 1: [45, 90]. Near miss puts it at ~48 deg (just 3 deg from crossing back into Whitelist!)
    // Sector 7: [315, 360]. Near miss puts it at ~357 deg (just 3 deg from crossing into Whitelist!)
    let jitter = (Math.random() - 0.5) * 10;
    if (isNearMiss && targetIndex === 1) {
      jitter = -13.5 + Math.random() * 3; // resting at ~49 deg
    } else if (isNearMiss && targetIndex === 7) {
      jitter = 13.5 - Math.random() * 3; // resting at ~356 deg
    }

    const targetWheelAngle = (centerAngle + jitter + 360) % 360;
    const targetMod = (360 - targetWheelAngle) % 360;
    const currentMod = rotation % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;

    // 7 full dramatic revolutions (2520 deg) + sector alignment
    const fullSpins = 360 * 7;
    const nextRot = rotation + fullSpins + delta;
    setRotation(nextRot);

    // Schedule realistic mechanical ticking audio as wheel decelerates over 4.8s
    const totalDuration = 4800;
    // Tick timings that start fast and slow down realistically
    const tickIntervals = [
      60, 70, 80, 90, 100, 115, 130, 150, 175, 205, 240, 280, 330, 390, 470, 570, 700, 860,
    ];
    let accumTime = 120;
    tickIntervals.forEach((interval, idx) => {
      accumTime += interval;
      if (accumTime < totalDuration - 200) {
        const timer = setTimeout(() => {
          setTickerFlick((prev) => !prev);
          audio.playTick(Math.sin(idx) * 40);
        }, accumTime);
        tickerTimerRef.current.push(timer);
      }
    });

    // Final arrival
    const winTimer = setTimeout(() => {
      setIsSpinning(false);
      setTickerFlick(false);
      setResultData({ sector, isNearMiss });
      audio.playWin(sector.points >= 250 || isNearMiss);
      onSpinWin(sector.points);
    }, totalDuration);
    tickerTimerRef.current.push(winTimer);
  };

  if (!isOpen) return null;

  const isCooldown = remainingMs > 0;
  const cx = 180;
  const cy = 180;
  const outerR = 166;
  const innerR = 48;
  const perDeg = 45;

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSpinning) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spin-modal-title"
    >
      <div className="modal-panel wheel-modal-panel">
        {/* Header Controls */}
        <div className="wheel-modal-top">
          <div className="wheel-mythic-pill">
            <span className="pill-star">⭐</span>
            <span>MYTHIC GRAND PRIZE: <strong>WHITELIST SPOT</strong></span>
          </div>

          <div className="wheel-top-actions">
            <button
              type="button"
              className="wheel-sound-btn"
              onClick={() => setSoundOn(!soundOn)}
              aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
              title={soundOn ? 'Sound On' : 'Sound Muted'}
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close modal"
              disabled={isSpinning}
            >
              ✕
            </button>
          </div>
        </div>

        <h3 id="spin-modal-title">Celestial Wheel of Fate</h3>
        <p className="desc">
          Spin the nocturnal sphere once every 24 hours. Awaken Nyx with dream points or seek the elusive Whitelist.
        </p>

        <div className="wheel-zone">
          {/* Wheel Frame & Bezel */}
          <div className="wheel-outer">
            {/* Ambient Background Aura */}
            <div className="wheel-ambient-glow" aria-hidden="true" />

            {/* Precision Golden Needle / Stopper */}
            <div
              className={`wheel-pointer ${tickerFlick ? 'ticking' : ''}`}
              aria-hidden="true"
            >
              <svg width="34" height="42" viewBox="0 0 34 42" fill="none">
                <defs>
                  <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff2c2" />
                    <stop offset="45%" stopColor="#f5ca53" />
                    <stop offset="100%" stopColor="#a37617" />
                  </linearGradient>
                  <filter id="pointerShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.75" />
                  </filter>
                </defs>
                {/* Pointer Dagger Shape */}
                <path
                  d="M17 40 L6 14 C4 9 7 3 13 3 L21 3 C27 3 30 9 28 14 Z"
                  fill="url(#pointerGrad)"
                  filter="url(#pointerShadow)"
                  stroke="#231707"
                  strokeWidth="1.5"
                />
                {/* Facet Detail Lines */}
                <path d="M17 40 L17 3" stroke="#fff8e7" strokeWidth="1.2" opacity="0.8" />
                {/* Inset Jewel at Top */}
                <circle cx="17" cy="11" r="3.5" fill="#e11d48" stroke="#ffe4e6" strokeWidth="1" />
              </svg>
            </div>

            {/* Outer Golden Studded Bezel Ring */}
            <div className="wheel-bezel" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => {
                const deg = i * 45;
                return (
                  <div
                    key={i}
                    className="bezel-stud"
                    style={{ transform: `rotate(${deg}deg) translateY(-172px)` }}
                  />
                );
              })}
            </div>

            {/* The Rotating SVG Wheel */}
            <div
              className="wheel-rotator"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning
                  ? 'transform 4.8s cubic-bezier(0.14, 0.96, 0.22, 1)'
                  : 'none',
              }}
            >
              <svg
                className="wheel-svg"
                viewBox="0 0 360 360"
                width="360"
                height="360"
              >
                <defs>
                  {/* Whitelist Special Radiant Liquid Gold Gradient */}
                  <linearGradient id="grad-whitelist" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff4b8" />
                    <stop offset="35%" stopColor="#f7cb45" />
                    <stop offset="85%" stopColor="#c78607" />
                    <stop offset="100%" stopColor="#875800" />
                  </linearGradient>

                  {/* Slices Gradients */}
                  {SECTORS.map((sec) => (
                    <linearGradient
                      key={sec.id}
                      id={`grad-${sec.id}`}
                      x1="0%"
                      y1="0%"
                      x2="80%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={sec.gradient[0]} />
                      <stop offset="100%" stopColor={sec.gradient[1]} />
                    </linearGradient>
                  ))}

                  {/* Center Medallion Gold Gradient */}
                  <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffe999" />
                    <stop offset="45%" stopColor="#d4a326" />
                    <stop offset="80%" stopColor="#805b0a" />
                    <stop offset="100%" stopColor="#3d2a02" />
                  </radialGradient>

                  {/* Inner Hub Shadow */}
                  <radialGradient id="hubInnerGrad" cx="40%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#252438" />
                    <stop offset="80%" stopColor="#0f0f18" />
                    <stop offset="100%" stopColor="#07070b" />
                  </radialGradient>
                </defs>

                {/* Draw the 8 Precision Arc Wedges */}
                {SECTORS.map((sec, i) => {
                  const startA = (i * perDeg * Math.PI) / 180;
                  const endA = ((i + 1) * perDeg * Math.PI) / 180;

                  // Outer coordinates (0 deg is 12 o'clock, clockwise)
                  const x1 = cx + outerR * Math.sin(startA);
                  const y1 = cy - outerR * Math.cos(startA);
                  const x2 = cx + outerR * Math.sin(endA);
                  const y2 = cy - outerR * Math.cos(endA);

                  // Arc path from center to perimeter
                  const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

                  const midAngle = i * perDeg + perDeg / 2;

                  return (
                    <g key={sec.id} className={`wheel-slice-group ${sec.isWhitelist ? 'slice-whitelist' : ''}`}>
                      {/* Wedge Slice Path */}
                      <path
                        d={d}
                        fill={`url(#grad-${sec.id})`}
                        stroke="rgba(240, 217, 160, 0.4)"
                        strokeWidth="1.2"
                        className="slice-wedge"
                      />

                      {/* Inner Gold Radiance Border for Whitelist */}
                      {sec.isWhitelist && (
                        <path
                          d={d}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          opacity="0.85"
                          className="slice-whitelist-glow"
                        />
                      )}

                      {/* Content inside Slice (Rotated to radial slice center) */}
                      <g transform={`rotate(${midAngle} ${cx} ${cy})`}>
                        {sec.isWhitelist ? (
                          // Whitelist Mythic Segment Styling
                          <>
                            <text
                              x={cx}
                              y={cy - 128}
                              textAnchor="middle"
                              fontSize="14"
                              fill="#1a1200"
                              filter="drop-shadow(0 1px 2px rgba(255,255,255,0.8))"
                            >
                              ⭐
                            </text>
                            <text
                              x={cx}
                              y={cy - 104}
                              textAnchor="middle"
                              fill="#100b02"
                              fontSize="11"
                              fontWeight="900"
                              letterSpacing="0.8"
                              fontFamily="var(--font-fredoka), system-ui, sans-serif"
                            >
                              WHITELIST
                            </text>
                            <rect
                              x={cx - 24}
                              y={cy - 92}
                              width="48"
                              height="14"
                              rx="7"
                              fill="#100b02"
                              opacity="0.9"
                            />
                            <text
                              x={cx}
                              y={cy - 82}
                              textAnchor="middle"
                              fill="#ffd700"
                              fontSize="8"
                              fontWeight="900"
                              letterSpacing="1"
                            >
                              MYTHIC
                            </text>
                          </>
                        ) : (
                          // Points Segment Styling
                          <>
                            <text
                              x={cx}
                              y={cy - 128}
                              textAnchor="middle"
                              fontSize="13"
                              opacity="0.95"
                            >
                              {sec.icon}
                            </text>
                            <text
                              x={cx}
                              y={cy - 100}
                              textAnchor="middle"
                              fill={sec.textColor}
                              fontSize="17"
                              fontWeight="900"
                              fontFamily="var(--font-fredoka), system-ui, sans-serif"
                              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.7))"
                            >
                              {sec.label}
                            </text>
                            <text
                              x={cx}
                              y={cy - 85}
                              textAnchor="middle"
                              fill="rgba(240, 217, 160, 0.85)"
                              fontSize="8.5"
                              fontWeight="800"
                              letterSpacing="1"
                            >
                              {sec.sublabel}
                            </text>
                          </>
                        )}
                      </g>
                    </g>
                  );
                })}

                {/* Outer Wheel Rim Line */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={outerR}
                  fill="none"
                  stroke="#d4a326"
                  strokeWidth="3.5"
                />

                {/* Center Medallion: Tiered Gold & Cosmic Obsidian Core */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerR + 3}
                  fill="url(#hubGrad)"
                  filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={innerR - 6}
                  fill="url(#hubInnerGrad)"
                  stroke="#f0d9a0"
                  strokeWidth="2"
                />

                {/* Embossed Gold Nyx Crescent Moon */}
                <path
                  d="M184 163 A14 14 0 1 1 172 195 A19 19 0 0 0 184 163 Z"
                  fill="#ffd700"
                  filter="drop-shadow(0 0 4px rgba(255,215,0,0.8))"
                />
                <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
              </svg>
            </div>
          </div>

          {/* Action Spin Button */}
          <div className="wheel-actions">
            <button
              type="button"
              className="btn btn-gold wheel-spin-btn"
              onClick={handleSpin}
              disabled={isCooldown || isSpinning}
              id="spin-action-button"
            >
              {isSpinning ? (
                <span className="spin-btn-content">
                  <span className="live-dot" />
                  <span>Divining Fate...</span>
                </span>
              ) : isCooldown ? (
                `Next spin in ${formatRemaining(remainingMs)}`
              ) : (
                <span className="spin-btn-content">
                  <span>🌙 Spin the Celestial Wheel</span>
                </span>
              )}
            </button>

            {/* Dynamic Result Banner */}
            {resultData && (
              <div
                className={`wheel-result-banner ${
                  resultData.isNearMiss
                    ? 'near-miss-banner'
                    : resultData.sector.points >= 250
                    ? 'jackpot-banner'
                    : ''
                }`}
                aria-live="polite"
              >
                {resultData.isNearMiss ? (
                  <>
                    <div className="near-miss-tag">⚡ AGONIZINGLY CLOSE!</div>
                    <div className="result-main-text">
                      Stopped right next to <strong>WHITELIST</strong>!
                    </div>
                    <div className="result-points-award">
                      +{resultData.sector.points} Dream Points added to your meter
                    </div>
                  </>
                ) : resultData.sector.points >= 500 ? (
                  <>
                    <div className="jackpot-tag">👑 CELESTIAL BLESSING!</div>
                    <div className="result-main-text">
                      Jackpot Roll: +{resultData.sector.points} Points!
                    </div>
                  </>
                ) : (
                  <>
                    <div className="result-main-text">
                      Landed on {resultData.sector.points} Points!
                    </div>
                    <div className="result-points-award">
                      +{resultData.sector.points} Dream Points added to your meter
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="cooldown-note">
              {isCooldown
                ? `The sphere rests. Next ritual available in ${formatRemaining(remainingMs)}.`
                : '1 daily spin resets every 24 hours. Points flow directly into the community Dream Meter.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
