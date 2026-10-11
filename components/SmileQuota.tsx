'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Settings, Bell, BellOff, ChevronDown, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';

function drawSmileSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number; visibility?: number }[],
  w: number, h: number, smiling: boolean
) {
  ctx.clearRect(0, 0, w, h);
  if (!lm || lm.length < 17) return;
  const color = smiling ? '#22d3ee' : 'rgba(99,102,241,0.45)';
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.shadowBlur  = smiling ? 16 : 4;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth   = smiling ? 2.5 : 1.5;
  ctx.lineCap     = 'round';
  const connections: [number, number][] = [
    [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[12,14],[14,16],
  ];
  for (const [a, b] of connections) {
    const lmA = lm[a], lmB = lm[b];
    if (!lmA || !lmB) continue;
    if ((lmA.visibility ?? 1) < 0.25 || (lmB.visibility ?? 1) < 0.25) continue;
    ctx.beginPath();
    ctx.moveTo(lmA.x * w, lmA.y * h);
    ctx.lineTo(lmB.x * w, lmB.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.shadowBlur = smiling ? 20 : 5;
  for (const i of [0,11,12,13,14,15,16]) {
    const p = lm[i];
    if (!p || (p.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, smiling ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ count, quota, isComplete, superActive }: {
  count: number; quota: number; isComplete: boolean; superActive: boolean;
}) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(count / quota, 1);
  const offset = circ * (1 - progress);
  const tipAngle = 2 * Math.PI * progress;
  const tipX = 100 + r * Math.cos(tipAngle);
  const tipY = 100 + r * Math.sin(tipAngle);
  const gradId = superActive ? 'rg-super' : isComplete ? 'rg-done' : 'rg-base';
  const tipColor = superActive ? '#fbbf24' : isComplete ? '#f0abfc' : '#c084fc';

  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="rg-base" x1="10" y1="100" x2="190" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b5ef4" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="rg-done" x1="10" y1="100" x2="190" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient id="rg-super" x1="10" y1="100" x2="190" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="dot-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Track */}
      <circle cx="100" cy="100" r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="14" />

      {/* Filled arc */}
      {count > 0 && (
        <circle cx="100" cy="100" r={r} fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          filter="url(#arc-glow)"
          style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
      )}

      {/* Glowing tip dot */}
      {count > 0 && count < quota && (
        <motion.circle
          r={8} fill={tipColor} filter="url(#dot-glow)"
          animate={{ cx: tipX, cy: tipY }}
          transition={{ type: 'spring', damping: 22, stiffness: 240, mass: 0.8 }}
        />
      )}
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY       = 'smiley_smile_quota';
const SETTINGS_KEY      = 'smiley_settings';
const NOTIF_KEY         = 'smiley_last_notif';
const QUOTA             = 10;
const SUPER_QUOTA       = 10;
const SMILE_THRESHOLD   = 0.20;
const SMILE_COOLDOWN    = 1500;
const SMILE_HOLD_FRAMES = 3;

type SessionMode = '1x10' | '2x5';

interface SmileSettings {
  notificationsEnabled: boolean;
  reminderTime: string;
  sessionMode: SessionMode;
}

interface SmileData {
  date: string;
  count: number;
  superCount: number;
  session1Done: boolean;
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

const DEFAULT_SETTINGS: SmileSettings = {
  notificationsEnabled: false,
  reminderTime: '20:00',
  sessionMode: '1x10',
};

function loadSettings(): SmileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s: SmileSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadSmileData(): SmileData {
  const empty: SmileData = { date: getTodayStr(), count: 0, superCount: 0, session1Done: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayStr()) return empty;
    return { ...empty, ...parsed, count: Math.min(parsed.count ?? 0, QUOTA), superCount: Math.min(parsed.superCount ?? 0, SUPER_QUOTA) };
  } catch { return empty; }
}

function saveSmileData(patch: Partial<SmileData>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSmileData(), ...patch }));
}

let notifTimeoutId: ReturnType<typeof setTimeout> | null = null;

function scheduleNotification(settings: SmileSettings, count: number) {
  if (notifTimeoutId) { clearTimeout(notifTimeoutId); notifTimeoutId = null; }
  if (!settings.notificationsEnabled || count >= QUOTA) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem(NOTIF_KEY) === getTodayStr()) return;
  const now = new Date();
  const [h, m] = settings.reminderTime.split(':').map(Number);
  const target = new Date(); target.setHours(h, m, 0, 0);
  const msUntil = target.getTime() - now.getTime();
  const fire = () => {
    const d = loadSmileData();
    if (d.count < QUOTA && Notification.permission === 'granted') {
      new Notification('Smile Quota Reminder 😊', {
        body: `${d.count}/10 smiles done — finish strong!`,
        icon: '/icon-192.png', tag: 'smile-quota',
      });
      localStorage.setItem(NOTIF_KEY, getTodayStr());
    }
  };
  if (msUntil <= 0) fire();
  else notifTimeoutId = setTimeout(fire, msUntil);
}

function fireFireworks() {
  const c = ['#818cf8','#c084fc','#e879f9','#22d3ee','#ffffff'];
  const s = (a: number, x: number) => confetti({ particleCount: 75, angle: a, spread: 60, origin: { x, y: 0.75 }, colors: c });
  s(60, 0); s(120, 1);
  setTimeout(() => confetti({ particleCount: 140, spread: 90, origin: { x: 0.5, y: 0.5 }, colors: c }), 300);
  setTimeout(() => { s(70, 0.15); s(110, 0.85); }, 650);
  setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.65 }, colors: c }), 950);
}

function fireMiniworks() {
  const c = ['#818cf8','#c084fc','#ffffff'];
  confetti({ particleCount: 60, spread: 70, origin: { x: 0.5, y: 0.6 }, colors: c });
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.3, y: 0.7 }, colors: c }), 300);
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.7, y: 0.7 }, colors: c }), 500);
}

function fireSuperFireworks() {
  const c = ['#fbbf24','#f97316','#fde68a','#e879f9','#ffffff'];
  const s = (a: number, x: number) => confetti({ particleCount: 100, angle: a, spread: 70, origin: { x, y: 0.75 }, colors: c });
  s(60, 0); s(120, 1);
  setTimeout(() => confetti({ particleCount: 200, spread: 120, origin: { x: 0.5, y: 0.5 }, colors: c }), 200);
  setTimeout(() => { s(65, 0.1); s(115, 0.9); }, 500);
  setTimeout(() => confetti({ particleCount: 150, spread: 130, startVelocity: 60, origin: { x: 0.5, y: 0.6 }, colors: c }), 800);
  setTimeout(() => { s(60, 0); s(120, 1); }, 1200);
}

function statusMsg(count: number, mode: SessionMode, superActive: boolean, superCount: number): string {
  if (superActive) {
    if (superCount === 0) return 'Bonus round — keep going';
    if (superCount < 5)  return 'Super Smile mode activated';
    if (superCount < 9)  return 'Almost there — unstoppable';
    if (superCount === 9) return 'One more for the ultimate day';
    return 'Super Smile Day complete';
  }
  if (mode === '2x5') {
    if (count === 0) return 'Smile at the camera to begin';
    if (count < 3)   return 'Great start — keep going';
    if (count < 5)   return 'Almost done with session 1';
    if (count === 5) return 'Session 1 done — take a breather';
    const s2 = count - 5;
    if (s2 < 3) return 'Session 2 in motion';
    if (s2 < 5) return 'Almost done — one big push';
  }
  if (count === 0) return 'Smile at the camera to begin';
  if (count < 3)   return 'Great start — keep going';
  if (count < 6)   return "You're on a roll";
  if (count < 9)   return 'Almost there — smile big';
  if (count === 9) return "One more — you've got this";
  return 'Quota complete';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SmileQuota() {
  const { isReady, detectSmile }                   = useFaceLandmarker();
  const { detect: detectPose, isReady: poseReady } = usePoseLandmarker();

  const videoRef           = useRef<HTMLVideoElement>(null);
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const rafRef             = useRef<number | null>(null);
  const lastCountedRef     = useRef<number>(0);
  const smileFramesRef     = useRef<number>(0);
  const smiledThisEventRef = useRef<boolean>(false);
  const fireworksFiredRef  = useRef<boolean>(false);
  const miniworksFiredRef  = useRef<boolean>(false);
  const superFiredRef      = useRef<boolean>(false);
  const superActiveRef     = useRef<boolean>(false);
  const sessionModeRef     = useRef<SessionMode>('1x10');

  const scrollRef            = useRef<HTMLDivElement>(null);
  const [showScrollHint,     setShowScrollHint]     = useState(true);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [settings,           setSettings]           = useState<SmileSettings>(DEFAULT_SETTINGS);
  const [showSettings,       setShowSettings]       = useState(false);
  const [cameraState,        setCameraState]        = useState<'idle'|'requesting'|'granted'|'denied'>('idle');
  const [autoStart,          setAutoStart]          = useState(false);
  const [smileCount,         setSmileCount]         = useState(0);
  const [superCount,         setSuperCount]         = useState(0);
  const [superActive,        setSuperActive]        = useState(false);
  const [isSmiling,          setIsSmiling]          = useState(false);
  const [smileScore,         setSmileScore]         = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = () => { if (el.scrollTop > 30) setShowScrollHint(false); };
    el.addEventListener('scroll', h, { passive: true });
    return () => el.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { superActiveRef.current = superActive; }, [superActive]);
  useEffect(() => { sessionModeRef.current = settings.sessionMode; }, [settings.sessionMode]);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    sessionModeRef.current = s.sessionMode;
    const d = loadSmileData();
    setSmileCount(Math.min(d.count, QUOTA));
    setSuperCount(Math.min(d.superCount, SUPER_QUOTA));
    if (d.count >= QUOTA) fireworksFiredRef.current = true;
    if (d.session1Done)   miniworksFiredRef.current = true;
    if (d.superCount >= SUPER_QUOTA) superFiredRef.current = true;
    if (d.superCount > 0) { setSuperActive(true); superActiveRef.current = true; }
    scheduleNotification(s, d.count);
  }, []);

  function updateSettings(patch: Partial<SmileSettings>) {
    const next = { ...settings, ...patch };
    saveSettings(next);
    setSettings(next);
    scheduleNotification(next, loadSmileData().count);
  }

  async function toggleNotifications() {
    if (settings.notificationsEnabled) {
      updateSettings({ notificationsEnabled: false });
    } else {
      let granted = false;
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') granted = true;
        else if (Notification.permission === 'default') {
          const res = await Notification.requestPermission().catch(() => 'default');
          granted = res === 'granted';
        }
      }
      updateSettings({ notificationsEnabled: true });
      if (granted) {
        setTimeout(() => new Notification('Reminders are on! 😊', {
          body: `We'll remind you at ${settings.reminderTime} if you haven't hit your quota.`,
          icon: '/icon-192.png', tag: 'smile-quota-confirm',
        }), 600);
      }
    }
  }

  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    function check() {
      const d = loadSmileData();
      if (d.count >= QUOTA) return;
      const now = new Date();
      const [h, m] = settings.reminderTime.split(':').map(Number);
      if (now.getHours() !== h || now.getMinutes() !== m) return;
      if (localStorage.getItem(NOTIF_KEY) === getTodayStr()) return;
      localStorage.setItem(NOTIF_KEY, getTodayStr());
      setShowReminderBanner(true);
    }
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [settings.notificationsEnabled, settings.reminderTime]);

  const requestCamera = useCallback(async () => {
    setCameraState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraState('granted');
    } catch { setCameraState('denied'); }
  }, []);

  const runLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isReady || cameraState !== 'granted') {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }
    const now   = performance.now();
    const score = detectSmile(video, now);
    const smiling = score >= SMILE_THRESHOLD;

    const canvas = canvasRef.current;
    if (canvas && poseReady) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pose = detectPose(video, now);
        drawSmileSkeleton(ctx, pose?.landmarks[0] ?? [], canvas.width, canvas.height, smiling);
      }
    }

    setIsSmiling(smiling);
    setSmileScore(score);

    if (smiling) {
      smileFramesRef.current = Math.min(smileFramesRef.current + 1, SMILE_HOLD_FRAMES + 10);
    } else {
      smileFramesRef.current     = 0;
      smiledThisEventRef.current = false;
    }

    if (smiling && !smiledThisEventRef.current && smileFramesRef.current >= SMILE_HOLD_FRAMES && now - lastCountedRef.current > SMILE_COOLDOWN) {
      smiledThisEventRef.current = true;
      lastCountedRef.current     = now;

      if (superActiveRef.current) {
        setSuperCount((prev) => {
          if (prev >= SUPER_QUOTA) return prev;
          const next = prev + 1;
          saveSmileData({ superCount: next });
          if (next >= SUPER_QUOTA && !superFiredRef.current) { superFiredRef.current = true; setTimeout(fireSuperFireworks, 200); }
          return next;
        });
      } else {
        setSmileCount((prev) => {
          if (prev >= QUOTA) return prev;
          const next = prev + 1;
          saveSmileData({ count: next });
          if (sessionModeRef.current === '2x5' && next === 5 && !miniworksFiredRef.current) {
            miniworksFiredRef.current = true;
            saveSmileData({ session1Done: true });
            setTimeout(fireMiniworks, 200);
          }
          if (next >= QUOTA && !fireworksFiredRef.current) { fireworksFiredRef.current = true; setTimeout(fireFireworks, 200); }
          return next;
        });
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, [isReady, detectSmile, cameraState, poseReady, detectPose]);

  useEffect(() => {
    if (cameraState !== 'granted') return;
    rafRef.current = requestAnimationFrame(runLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cameraState, runLoop]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem('smiley_camera_autostart') === 'true') requestCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBaseComplete  = smileCount >= QUOTA;
  const isSuperComplete = superCount >= SUPER_QUOTA;
  const displayCount    = superActive ? superCount : smileCount;
  const displayQuota    = superActive ? SUPER_QUOTA : QUOTA;

  const accent  = superActive ? '#f59e0b' : isBaseComplete ? '#f0abfc' : '#a855f7';
  const accent2 = superActive ? '#ef4444' : isBaseComplete ? '#9333ea' : '#5b5ef4';

  const accentGrad = superActive
    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
    : isBaseComplete
      ? 'linear-gradient(135deg, #9333ea, #f0abfc)'
      : 'linear-gradient(135deg, #5b5ef4, #a855f7)';

  const bracketColor = isSmiling && cameraState === 'granted'
    ? 'rgba(34,211,238,0.75)'
    : 'rgba(99,102,241,0.35)';

  return (
    <div className="relative" style={{ height: '100dvh' }}>

      {/* Reminder banner */}
      <AnimatePresence>
        {showReminderBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="absolute top-16 left-4 right-4 z-[60] rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.4)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <Bell size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Smile reminder</p>
              <p className="text-xs text-gray-400 mt-0.5">You haven&apos;t hit your quota yet today</p>
            </div>
            <button onClick={() => setShowReminderBanner(false)} className="p-1 btn-press">
              <X size={14} className="text-gray-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-scroll h-full" ref={scrollRef}>
        <div className="min-h-full px-5 pt-safe pb-8 flex flex-col">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="flex items-center justify-between pt-4 mb-6"
          >
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight" style={{
                  background: 'linear-gradient(90deg, #f1f5f9 0%, #c084fc 60%, #818cf8 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  Smiley
                </h1>
                {isBaseComplete && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 14, stiffness: 300 }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(232,121,249,0.18)',
                      border: '1px solid rgba(232,121,249,0.45)',
                      color: '#f0abfc',
                    }}
                  >
                    ✓ Done
                  </motion.span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.55)' }}>Daily happiness workout</p>
            </div>
            <button
              onClick={() => setShowSettings(v => !v)}
              className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
              style={{
                background: showSettings ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${showSettings ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: showSettings ? '0 0 18px rgba(99,102,241,0.25)' : 'none',
              }}
            >
              <Settings size={15} style={{ color: showSettings ? '#818cf8' : '#6b7280' }} />
            </button>
          </motion.div>

          {/* ── Settings panel ── */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                className="overflow-hidden mb-5"
              >
                <div className="rounded-2xl p-4 flex flex-col gap-4 glass-card-accent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {settings.notificationsEnabled
                        ? <Bell size={14} style={{ color: '#818cf8' }} />
                        : <BellOff size={14} className="text-gray-600" />}
                      <span className="text-sm font-medium text-white">Reminders</span>
                    </div>
                    <button
                      onClick={toggleNotifications}
                      className="relative rounded-full btn-press flex-shrink-0"
                      style={{
                        width: 44, height: 24,
                        background: settings.notificationsEnabled ? '#6366f1' : 'rgba(255,255,255,0.1)',
                        boxShadow: settings.notificationsEnabled ? '0 0 14px rgba(99,102,241,0.5)' : 'none',
                        transition: 'background 0.2s, box-shadow 0.2s',
                      }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                        style={{ left: settings.notificationsEnabled ? 'calc(100% - 1.375rem)' : '0.125rem' }} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {settings.notificationsEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-center justify-between pl-6">
                          <span className="text-xs text-gray-500">Remind me at</span>
                          <input type="time" value={settings.reminderTime}
                            onChange={e => updateSettings({ reminderTime: e.target.value })}
                            className="bg-transparent text-xs font-semibold text-white border-none outline-none"
                            style={{ colorScheme: 'dark' }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest block mb-2.5"
                      style={{ color: 'rgba(129,140,248,0.7)' }}>
                      Session style
                    </span>
                    <div className="flex gap-2">
                      {(['1x10', '2x5'] as SessionMode[]).map((mode) => (
                        <button key={mode} onClick={() => updateSettings({ sessionMode: mode })}
                          className="flex-1 py-2 rounded-xl text-xs font-medium btn-press"
                          style={{
                            background: settings.sessionMode === mode
                              ? 'rgba(99,102,241,0.22)'
                              : 'rgba(255,255,255,0.04)',
                            border: settings.sessionMode === mode
                              ? '1px solid rgba(99,102,241,0.6)'
                              : '1px solid rgba(255,255,255,0.08)',
                            color: settings.sessionMode === mode ? '#a5b4fc' : '#6b7280',
                            boxShadow: settings.sessionMode === mode ? '0 0 12px rgba(99,102,241,0.25)' : 'none',
                          }}>
                          {mode === '1x10' ? '1 session · 10' : '2 sessions · 5 each'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Hero: Progress ring ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col items-center mb-5"
          >
            {/* Ring */}
            <div className="relative" style={{ width: 228, height: 228 }}>
              {/* Completion outer pulse ring */}
              {(isBaseComplete || isSuperComplete) && (
                <div className="absolute inset-[-6px] rounded-full ring-pulse pointer-events-none"
                  style={{ border: `2px solid ${accent}55` }} />
              )}

              {/* Background glow disc */}
              <div className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, ${accent}22 0%, ${accent}0a 45%, transparent 72%)`,
                  transition: 'background 0.5s ease',
                }} />

              <ProgressRing
                count={displayCount}
                quota={displayQuota}
                isComplete={isBaseComplete}
                superActive={superActive}
              />

              {/* Counter */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={superActive ? `s${superCount}` : smileCount}
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', damping: 17, stiffness: 290 }}
                    className="font-bold tabular-nums leading-none select-none"
                    style={{
                      fontSize: 68,
                      color: accent,
                      textShadow: `0 0 40px ${accent}70, 0 0 80px ${accent}30`,
                      transition: 'color 0.4s ease, text-shadow 0.4s ease',
                    }}
                  >
                    {displayCount}
                  </motion.span>
                </AnimatePresence>

                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  of {displayQuota}
                </p>

                {/* Smiling badge inside ring */}
                <AnimatePresence>
                  {isSmiling && cameraState === 'granted' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.7, y: 5 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full mt-2"
                      style={{
                        background: 'rgba(34,211,238,0.12)',
                        border: '1px solid rgba(34,211,238,0.4)',
                        boxShadow: '0 0 16px rgba(34,211,238,0.2)',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
                      <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#22d3ee' }}>
                        Smiling
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Status text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={`${superActive}-${displayCount}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-[13px] font-medium mt-3 text-center"
                style={{ color: 'rgba(148,163,184,0.75)' }}
              >
                {statusMsg(smileCount, settings.sessionMode, superActive, superCount)}
              </motion.p>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="mt-4">
              {!superActive && settings.sessionMode === '2x5' ? (
                <div className="flex flex-col items-center gap-2">
                  {[
                    { label: 'S1', c: Math.min(smileCount, 5), color: '#818cf8' },
                    { label: 'S2', c: Math.max(0, smileCount - 5), color: '#c084fc' },
                  ].map(({ label, c, color }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="text-[10px] font-medium w-4 text-right" style={{ color: 'rgba(99,102,241,0.6)' }}>{label}</span>
                      <div className="flex gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <motion.div key={i} initial={false}
                            animate={{ scale: i < c ? 1 : 0.5, opacity: i < c ? 1 : 0.15 }}
                            transition={{ type: 'spring', damping: 14, stiffness: 340 }}
                            style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: i < c ? color : 'rgba(255,255,255,0.15)',
                              boxShadow: i < c ? `0 0 10px ${color}` : 'none',
                            }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {Array.from({ length: displayQuota }).map((_, i) => (
                    <motion.div key={i} initial={false}
                      animate={{ scale: i < displayCount ? 1 : 0.5, opacity: i < displayCount ? 1 : 0.15 }}
                      transition={{ type: 'spring', damping: 14, stiffness: 340 }}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: i < displayCount ? accent : 'rgba(255,255,255,0.15)',
                        boxShadow: i < displayCount ? `0 0 10px ${accent}` : 'none',
                      }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Camera ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="rounded-2xl overflow-hidden relative mb-3"
            style={{
              ...(cameraState === 'granted' || cameraState === 'requesting'
                ? { aspectRatio: '4/3' }
                : { minHeight: 200 }),
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${isSmiling && cameraState === 'granted'
                ? 'rgba(34,211,238,0.5)'
                : 'rgba(255,255,255,0.09)'}`,
              boxShadow: isSmiling && cameraState === 'granted'
                ? '0 0 28px rgba(34,211,238,0.14), inset 0 0 28px rgba(34,211,238,0.04)'
                : 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
          >
            <video ref={videoRef} className="camera-feed w-full h-full object-cover" playsInline muted
              style={{ display: cameraState === 'granted' ? 'block' : 'none' }} />
            <canvas ref={canvasRef} className="camera-feed absolute inset-0 w-full h-full pointer-events-none"
              style={{ display: cameraState === 'granted' ? 'block' : 'none' }} />

            {/* HUD corner brackets */}
            {cameraState === 'granted' && (
              <>
                <div className="absolute top-3 left-3 w-6 h-6 pointer-events-none"
                  style={{ borderTop: `2px solid ${bracketColor}`, borderLeft: `2px solid ${bracketColor}`, transition: 'border-color 0.35s' }} />
                <div className="absolute top-3 right-3 w-6 h-6 pointer-events-none"
                  style={{ borderTop: `2px solid ${bracketColor}`, borderRight: `2px solid ${bracketColor}`, transition: 'border-color 0.35s' }} />
                <div className="absolute bottom-3 left-3 w-6 h-6 pointer-events-none"
                  style={{ borderBottom: `2px solid ${bracketColor}`, borderLeft: `2px solid ${bracketColor}`, transition: 'border-color 0.35s' }} />
                <div className="absolute bottom-3 right-3 w-6 h-6 pointer-events-none"
                  style={{ borderBottom: `2px solid ${bracketColor}`, borderRight: `2px solid ${bracketColor}`, transition: 'border-color 0.35s' }} />
              </>
            )}

            {/* AI Active badge */}
            {cameraState === 'granted' && isReady && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none z-10"
                style={{
                  background: 'rgba(8,8,16,0.7)',
                  border: `1px solid ${isSmiling ? 'rgba(34,211,238,0.4)' : 'rgba(99,102,241,0.3)'}`,
                  backdropFilter: 'blur(8px)',
                  transition: 'border-color 0.3s',
                }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: isSmiling ? '#22d3ee' : '#6366f1' }} />
                <span className="text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: isSmiling ? '#22d3ee' : 'rgba(129,140,248,0.8)' }}>
                  {isSmiling ? 'Smile Detected' : 'AI Active'}
                </span>
              </div>
            )}

            {cameraState === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(99,102,241,0.14)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    boxShadow: '0 0 24px rgba(99,102,241,0.18)',
                  }}
                >
                  <Camera size={22} style={{ color: '#818cf8' }} />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Enable camera</p>
                  <p className="text-xs text-gray-500">All processing stays on your device</p>
                </div>
                <button
                  onClick={() => { if (autoStart) localStorage.setItem('smiley_camera_autostart', 'true'); requestCamera(); }}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white btn-press"
                  style={{
                    background: accentGrad,
                    boxShadow: `0 4px 22px ${accent}45`,
                  }}
                >
                  Allow Camera
                </button>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)}
                    className="w-3.5 h-3.5 accent-violet-500" />
                  <span className="text-xs text-gray-500">Auto-start next time</span>
                </label>
              </div>
            )}

            {cameraState === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#818cf8', borderTopColor: 'transparent' }} />
                <p className="text-xs text-gray-400">Starting camera…</p>
              </div>
            )}

            {cameraState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                <p className="text-sm font-semibold text-red-400">Camera access denied</p>
                <p className="text-xs text-gray-500 text-center">Enable camera in your browser settings and reload</p>
              </div>
            )}

            {cameraState === 'granted' && !isReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(8,8,16,0.75)', backdropFilter: 'blur(8px)' }}>
                <div className="w-7 h-7 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#818cf8', borderTopColor: 'transparent' }} />
                <p className="text-xs text-gray-400">Loading AI model…</p>
              </div>
            )}

            {/* In-camera progress overlay */}
            {cameraState === 'granted' && isReady && (
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8 flex flex-col items-center gap-1.5 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(8,8,16,0.9) 0%, transparent 100%)' }}>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tabular-nums"
                    style={{ color: accent, textShadow: `0 0 12px ${accent}70` }}>
                    {displayCount}
                  </span>
                  <span className="text-[11px] text-gray-600">/ {displayQuota}</span>
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: displayQuota }).map((_, i) => (
                    <div key={i} className="rounded-full transition-all duration-200"
                      style={{
                        width: 5, height: 5,
                        background: i < displayCount ? accent : 'rgba(255,255,255,0.15)',
                        boxShadow: i < displayCount ? `0 0 6px ${accent}` : 'none',
                      }} />
                  ))}
                </div>
              </div>
            )}

            {/* Complete overlays */}
            <AnimatePresence>
              {isBaseComplete && !superActive && cameraState === 'granted' && (
                <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 py-2.5 text-center text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(90deg, ${accent2}35, ${accent}35)`,
                    backdropFilter: 'blur(12px)',
                    borderTop: `1px solid ${accent}40`,
                  }}>
                  Quota complete ✦
                </motion.div>
              )}
              {superActive && isSuperComplete && cameraState === 'granted' && (
                <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 py-2.5 text-center text-sm font-semibold text-white"
                  style={{
                    background: 'rgba(245,158,11,0.22)',
                    backdropFilter: 'blur(12px)',
                    borderTop: '1px solid rgba(245,158,11,0.4)',
                  }}>
                  Super Smile Day complete ✦
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Smile Intensity meter ── */}
          {cameraState === 'granted' && isReady && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="mb-4 px-1"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(99,102,241,0.7)' }}>
                  Smile Intensity
                </span>
                <motion.span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: isSmiling ? '#22d3ee' : 'rgba(148,163,184,0.45)' }}
                  animate={{ color: isSmiling ? '#22d3ee' : 'rgba(148,163,184,0.45)' }}
                  transition={{ duration: 0.3 }}
                >
                  {Math.round(smileScore * 100)}%
                </motion.span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: isSmiling ? 'linear-gradient(90deg, #22d3ee, #6366f1)' : accentGrad }}
                  animate={{ width: `${Math.max(smileScore * 100, 1.5)}%` }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.4 }}
                />
              </div>
            </motion.div>
          )}

          {/* ── Science card ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl overflow-hidden mb-4"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="h-px w-full" style={{ background: accentGrad, opacity: 0.65 }} />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm">🧠</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(129,140,248,0.75)' }}>
                  Did you know
                </span>
              </div>
              <p className="text-[13px] text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Even a forced smile lifts your mood.</span>{' '}
                Your face muscles signal your brain to release{' '}
                <span style={{ color: accent }} className="font-medium">serotonin</span> and{' '}
                <span style={{ color: accent }} className="font-medium">dopamine</span>{' '}
                — the same chemicals as genuine joy.
              </p>
            </div>
          </motion.div>

          {/* ── Super Smile CTA ── */}
          <AnimatePresence>
            {isBaseComplete && !superActive && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                transition={{ delay: 0.08 }}
                className="rounded-2xl overflow-hidden mb-4"
                style={{
                  background: 'rgba(245,158,11,0.05)',
                  border: '1px solid rgba(245,158,11,0.22)',
                }}
              >
                <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', opacity: 0.65 }} />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">⚡</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'rgba(245,158,11,0.8)' }}>
                      Super Smile Day
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-300 leading-relaxed mb-4">
                    Smile <span className="text-white font-semibold">10 more times</span> to unlock a Super Smile Day — double the dopamine, double the glory.
                  </p>
                  <button
                    onClick={() => { setSuperActive(true); superActiveRef.current = true; saveSmileData({ superCount: 0 }); }}
                    className="w-full py-3 rounded-xl font-semibold text-sm btn-press"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: '#0c0c14',
                      boxShadow: '0 4px 24px rgba(245,158,11,0.35)',
                    }}
                  >
                    Go Super ⚡
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1" />
        </div>
      </div>

      {/* Scroll hint */}
      <AnimatePresence>
        {showScrollHint && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-50"
          >
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
              <ChevronDown size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
