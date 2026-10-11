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
  const color = smiling ? '#00ff88' : 'rgba(0,200,255,0.45)';
  const glow  = smiling ? 22 : 6;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.shadowBlur  = glow;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth   = smiling ? 3 : 1.5;
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
  ctx.shadowBlur = glow * 1.5;
  for (const i of [0,11,12,13,14,15,16]) {
    const p = lm[i];
    if (!p || (p.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, smiling ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
  const c = ['#00f0ff','#ff00cc','#7b2fff','#ffaa00','#ffffff'];
  const s = (a: number, x: number) => confetti({ particleCount: 75, angle: a, spread: 60, origin: { x, y: 0.75 }, colors: c });
  s(60, 0); s(120, 1);
  setTimeout(() => confetti({ particleCount: 140, spread: 90, origin: { x: 0.5, y: 0.5 }, colors: c }), 300);
  setTimeout(() => { s(70, 0.15); s(110, 0.85); }, 650);
  setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.65 }, colors: c }), 950);
}

function fireMiniworks() {
  const c = ['#00f0ff','#7b2fff','#ffffff'];
  confetti({ particleCount: 60, spread: 70, origin: { x: 0.5, y: 0.6 }, colors: c });
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.3, y: 0.7 }, colors: c }), 300);
  setTimeout(() => confetti({ particleCount: 40, spread: 50, origin: { x: 0.7, y: 0.7 }, colors: c }), 500);
}

function fireSuperFireworks() {
  const c = ['#ffaa00','#ff6600','#ffdd00','#ff00cc','#ffffff'];
  const s = (a: number, x: number) => confetti({ particleCount: 100, angle: a, spread: 70, origin: { x, y: 0.75 }, colors: c });
  s(60, 0); s(120, 1);
  setTimeout(() => confetti({ particleCount: 200, spread: 120, origin: { x: 0.5, y: 0.5 }, colors: c }), 200);
  setTimeout(() => { s(65, 0.1); s(115, 0.9); }, 500);
  setTimeout(() => confetti({ particleCount: 150, spread: 130, startVelocity: 60, origin: { x: 0.5, y: 0.6 }, colors: c }), 800);
  setTimeout(() => { s(60, 0); s(120, 1); }, 1200);
}

function statusMsg(count: number, mode: SessionMode, superActive: boolean, superCount: number): string {
  if (superActive) {
    if (superCount === 0) return 'Bonus round! Keep those smiles coming!';
    if (superCount < 5)  return 'Super Smile mode activated 🌟';
    if (superCount < 9)  return "Almost there — you're unstoppable!";
    if (superCount === 9) return 'One more for the ultimate day!';
    return 'SUPER SMILE DAY COMPLETE! 🏆';
  }
  if (mode === '2x5') {
    if (count < 5) {
      if (count === 0) return 'Smile at the camera to begin!';
      if (count < 3)   return 'Great start — keep going!';
      return 'Almost done with session 1!';
    }
    if (count === 5) return 'Session 1 done! Take a breather 🌟';
    const s2 = count - 5;
    if (s2 < 3) return 'Session 2 in motion 🔥';
    if (s2 < 5) return 'Almost done — one big push!';
  }
  if (count === 0) return 'Smile at the camera to begin!';
  if (count < 3)   return 'Great start — keep going!';
  if (count < 6)   return "You're on a roll 🔥";
  if (count < 9)   return 'Almost there — smile big!';
  if (count === 9) return "One more! You've got this!";
  return "Quota complete! You're glowing ✨";
}

export default function SmileQuota() {
  const { isReady, detectSmile }          = useFaceLandmarker();
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
    const now     = performance.now();
    const score   = detectSmile(video, now);
    const smiling = score >= SMILE_THRESHOLD;

    const canvas = canvasRef.current;
    if (canvas && poseReady) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pose = detectPose(video, now);
        drawSmileSkeleton(ctx, pose?.landmarks[0] ?? [], canvas.width, canvas.height, smiling);
      }
    }

    setIsSmiling(smiling);

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

  const isBaseComplete  = smileCount  >= QUOTA;
  const isSuperComplete = superCount  >= SUPER_QUOTA;

  return (
    <div className="relative" style={{ height: '100dvh' }}>

      <AnimatePresence>
        {showReminderBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="absolute top-16 left-4 right-4 z-[60] rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.4)', backdropFilter: 'blur(16px)' }}
          >
            <Bell size={18} style={{ color: '#00f0ff', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Smile reminder!</p>
              <p className="text-xs text-gray-400 mt-0.5">You haven&apos;t hit your 10-smile quota yet today 😊</p>
            </div>
            <button onClick={() => setShowReminderBanner(false)} className="flex-shrink-0 p-1">
              <X size={15} className="text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-scroll cyber-bg scanline h-full" ref={scrollRef}>
        <div className="min-h-full px-5 pt-safe pb-8 flex flex-col">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="flex items-center gap-3 pt-4 mb-4"
          >
            <div className="flex-1">
              <h1 className="text-xl font-black tracking-tight" style={{
                background: 'linear-gradient(90deg,#00d4ff 0%,#b066ff 55%,#ff00cc 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Smiley</h1>
              <p className="text-[11px] text-gray-500">Daily happiness workout</p>
            </div>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="w-10 h-10 rounded-xl flex items-center justify-center btn-press"
              style={{
                background: showSettings ? 'rgba(0,240,255,0.12)' : 'rgba(18,18,40,0.8)',
                border: showSettings ? '1px solid rgba(0,240,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Settings size={17} style={{ color: showSettings ? '#00f0ff' : '#6b7280' }} />
            </button>
          </motion.div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                className="overflow-hidden mb-4"
              >
                <div className="rounded-2xl p-4 flex flex-col gap-4"
                  style={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(0,240,255,0.12)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {settings.notificationsEnabled
                        ? <Bell size={15} style={{ color: '#00f0ff' }} />
                        : <BellOff size={15} className="text-gray-500" />}
                      <span className="text-sm font-semibold text-white">Reminders</span>
                    </div>
                    <button
                      onClick={toggleNotifications}
                      className="relative w-11 h-6 rounded-full transition-colors duration-200 btn-press"
                      style={{ background: settings.notificationsEnabled ? 'linear-gradient(135deg,#00f0ff,#7b2fff)' : 'rgba(255,255,255,0.1)' }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
                        style={{ left: settings.notificationsEnabled ? 'calc(100% - 1.375rem)' : '0.125rem' }} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {settings.notificationsEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-center justify-between pl-5">
                          <span className="text-xs text-gray-400">Remind me at</span>
                          <input type="time" value={settings.reminderTime}
                            onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                            className="bg-transparent text-xs font-bold text-white border-none outline-none"
                            style={{ colorScheme: 'dark' }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

                  <div>
                    <span className="text-sm font-semibold text-white block mb-2.5">Session style</span>
                    <div className="flex gap-2">
                      {(['1x10', '2x5'] as SessionMode[]).map((mode) => (
                        <button key={mode} onClick={() => updateSettings({ sessionMode: mode })}
                          className="flex-1 py-2 rounded-xl text-xs font-bold btn-press"
                          style={{
                            background: settings.sessionMode === mode ? 'linear-gradient(135deg,rgba(0,240,255,0.15),rgba(123,47,255,0.15))' : 'rgba(255,255,255,0.05)',
                            border: settings.sessionMode === mode ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
                            color: settings.sessionMode === mode ? '#00f0ff' : '#6b7280',
                          }}>
                          {mode === '1x10' ? '1 session · 10 smiles' : '2 sessions · 5 each'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Science card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="rounded-3xl p-5 mb-6"
            style={{ background: 'linear-gradient(135deg,rgba(255,0,204,0.07),rgba(123,47,255,0.1))', border: '1px solid rgba(255,0,204,0.14)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🧠</span>
              <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: '#ff00cc' }}>Did You Know?</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong className="text-white">Even a fake smile makes you happier.</strong>{' '}
              When you smile — real or forced — your face muscles signal your brain to release{' '}
              <span style={{ color: '#00f0ff', fontWeight: 700 }}>serotonin</span> and{' '}
              <span style={{ color: '#ff00cc', fontWeight: 700 }}>dopamine</span>, the exact same chemicals as genuine joy.{' '}
              <strong className="text-white">Fake it till you feel it. Science says so.</strong>
            </p>
          </motion.div>

          {/* Counter */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="flex flex-col items-center mb-6"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={superActive ? `s${superCount}` : smileCount}
                initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                className="text-9xl font-black leading-none tabular-nums"
                style={{
                  color: superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff',
                  textShadow: superActive ? '0 0 40px #ffaa0099,0 0 80px #ffaa0033' : isBaseComplete ? '0 0 40px #ff00cc99,0 0 80px #ff00cc33' : '0 0 40px #00f0ff99,0 0 80px #00f0ff33',
                }}
              >
                {superActive ? superCount : smileCount}
              </motion.span>
            </AnimatePresence>

            <div className="flex items-center gap-1.5 mt-1 mb-5">
              <span className="text-sm text-gray-500">of</span>
              <span className="text-sm font-bold text-white">{superActive ? SUPER_QUOTA : QUOTA}</span>
              <span className="text-sm text-gray-500">{superActive ? 'bonus smiles' : 'smiles today'}</span>
            </div>

            {!superActive && settings.sessionMode === '2x5' ? (
              <div className="flex flex-col items-center gap-2">
                {[
                  { label: 'Session 1', count: Math.min(smileCount, 5), total: 5, color: '#00f0ff' },
                  { label: 'Session 2', count: Math.max(0, smileCount - 5), total: 5, color: '#ff00cc' },
                ].map(({ label, count: c, total, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 w-16 text-right">{label}</span>
                    <div className="flex gap-2">
                      {Array.from({ length: total }).map((_, i) => (
                        <motion.div key={i} initial={false}
                          animate={{ scale: i < c ? 1 : 0.7, opacity: i < c ? 1 : 0.22 }}
                          transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                          className="w-4 h-4 rounded-full"
                          style={{ background: i < c ? color : 'rgba(255,255,255,0.15)', boxShadow: i < c ? `0 0 10px ${color}99` : 'none' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2.5">
                {Array.from({ length: superActive ? SUPER_QUOTA : QUOTA }).map((_, i) => {
                  const filled = superActive ? superCount : smileCount;
                  const color  = superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff';
                  return (
                    <motion.div key={i} initial={false}
                      animate={{ scale: i < filled ? 1 : 0.7, opacity: i < filled ? 1 : 0.22 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 320 }}
                      className="w-4 h-4 rounded-full"
                      style={{ background: i < filled ? color : 'rgba(255,255,255,0.15)', boxShadow: i < filled ? `0 0 10px ${color}99` : 'none' }} />
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.p
                key={`${superActive}-${superActive ? superCount : smileCount}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mt-4 text-sm font-semibold text-gray-400"
              >
                {statusMsg(smileCount, settings.sessionMode, superActive, superCount)}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Camera */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="rounded-3xl overflow-hidden relative mb-6 mx-auto"
            style={{
              ...(cameraState === 'granted' || cameraState === 'requesting' ? { aspectRatio: '4/3', width: '65%' } : { width: '92%', minHeight: 260 }),
              background: 'rgba(10,10,26,0.95)',
              border: isSmiling ? '2px solid #00f0ff' : '1px solid rgba(255,255,255,0.07)',
              boxShadow: isSmiling ? '0 0 32px rgba(0,240,255,0.28)' : 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <video ref={videoRef} className="camera-feed w-full h-full object-cover" playsInline muted
              style={{ display: cameraState === 'granted' ? 'block' : 'none' }} />
            <canvas ref={canvasRef} className="camera-feed absolute inset-0 w-full h-full pointer-events-none"
              style={{ display: cameraState === 'granted' ? 'block' : 'none' }} />

            {cameraState === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <motion.div animate={{ scale: [1,1.06,1] }} transition={{ duration: 2.2, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)' }}>
                  <Camera size={28} style={{ color: '#00f0ff' }} />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white mb-1">Enable camera to detect smiles</p>
                  <p className="text-xs text-gray-500">All processing is on-device — nothing is uploaded</p>
                </div>
                <button
                  onClick={() => { if (autoStart) localStorage.setItem('smiley_camera_autostart', 'true'); requestCamera(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-sm text-[#050510] btn-press"
                  style={{ background: 'linear-gradient(135deg,#00f0ff,#7b2fff)', boxShadow: '0 0 20px rgba(0,240,255,0.35)' }}
                >
                  Allow Camera
                </button>
                <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                  <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-400" />
                  <span className="text-xs text-gray-500">Always start automatically</span>
                </label>
              </div>
            )}

            {cameraState === 'requesting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-9 h-9 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }} />
                <p className="text-xs text-gray-400">Starting camera…</p>
              </div>
            )}

            {cameraState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                <p className="text-sm font-bold text-red-400">Camera access denied</p>
                <p className="text-xs text-gray-500 text-center">Allow camera access in your browser settings and reload</p>
              </div>
            )}

            {cameraState === 'granted' && !isReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(5,5,16,0.72)', backdropFilter: 'blur(6px)' }}>
                <div className="w-9 h-9 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#00f0ff', borderTopColor: 'transparent' }} />
                <p className="text-xs text-gray-300 font-medium">Loading smile AI…</p>
              </div>
            )}

            {cameraState === 'granted' && isReady && (
              <AnimatePresence>
                {isSmiling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -4 }} transition={{ type: 'spring', damping: 18 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full flex items-center gap-2"
                    style={{
                      background: superActive ? 'rgba(255,170,0,0.18)' : 'rgba(0,240,255,0.18)',
                      border: `1px solid ${superActive ? 'rgba(255,170,0,0.5)' : 'rgba(0,240,255,0.5)'}`,
                      backdropFilter: 'blur(12px)',
                      boxShadow: `0 0 16px ${superActive ? 'rgba(255,170,0,0.3)' : 'rgba(0,240,255,0.3)'}`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: superActive ? '#ffaa00' : '#00f0ff' }} />
                    <span className="text-[11px] font-black tracking-widest uppercase"
                      style={{ color: superActive ? '#ffaa00' : '#00f0ff' }}>
                      {superActive ? 'Super Smile' : 'Smiling'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {cameraState === 'granted' && isReady && (
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6 flex flex-col items-center gap-1.5 pointer-events-none"
                style={{ background: 'linear-gradient(to top,rgba(5,5,16,0.82) 0%,transparent 100%)' }}>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tabular-nums leading-none"
                    style={{ color: superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff', textShadow: '0 0 12px currentColor' }}>
                    {superActive ? superCount : smileCount}
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">/ {superActive ? SUPER_QUOTA : QUOTA}</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: superActive ? SUPER_QUOTA : QUOTA }).map((_, i) => {
                    const filled = superActive ? superCount : smileCount;
                    const color  = superActive ? '#ffaa00' : isBaseComplete ? '#ff00cc' : '#00f0ff';
                    return <div key={i} className="rounded-full transition-all duration-200"
                      style={{ width: 7, height: 7, background: i < filled ? color : 'rgba(255,255,255,0.2)', boxShadow: i < filled ? `0 0 6px ${color}` : 'none' }} />;
                  })}
                </div>
              </div>
            )}

            <AnimatePresence>
              {isBaseComplete && !superActive && cameraState === 'granted' && (
                <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 py-2.5 text-center font-black text-sm tracking-wide"
                  style={{ background: 'linear-gradient(90deg,rgba(0,240,255,0.25),rgba(255,0,204,0.25))', backdropFilter: 'blur(12px)', color: '#fff' }}>
                  🎉 Quota Complete!
                </motion.div>
              )}
              {superActive && isSuperComplete && cameraState === 'granted' && (
                <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 py-2.5 text-center font-black text-sm tracking-wide"
                  style={{ background: 'linear-gradient(90deg,rgba(255,170,0,0.3),rgba(255,0,204,0.3))', backdropFilter: 'blur(12px)', color: '#fff' }}>
                  🏆 Super Smile Day Complete!
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Super Smile CTA */}
          <AnimatePresence>
            {isBaseComplete && !superActive && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ delay: 0.15 }}
                className="rounded-3xl p-5 mb-6"
                style={{ background: 'linear-gradient(135deg,rgba(255,170,0,0.08),rgba(255,0,204,0.1))', border: '1px solid rgba(255,170,0,0.22)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚡</span>
                  <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: '#ffaa00' }}>Super Smile Day</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  Crush it with <strong className="text-white">10 bonus smiles</strong> to turn today into a{' '}
                  <span style={{ color: '#ffaa00', fontWeight: 700 }}>Super Smile Day</span>. Double the dopamine, double the glory.
                </p>
                <button
                  onClick={() => { setSuperActive(true); superActiveRef.current = true; saveSmileData({ superCount: 0 }); }}
                  className="w-full py-3 rounded-2xl font-black text-sm btn-press"
                  style={{ background: 'linear-gradient(135deg,#ffaa00,#ff6600)', boxShadow: '0 0 20px rgba(255,170,0,0.35)', color: '#050510' }}
                >
                  Go Super! ⚡
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1" />
        </div>
      </div>

      <AnimatePresence>
        {showScrollHint && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-50"
          >
            <p className="text-[11px] text-gray-400 font-semibold tracking-wide">scroll for more</p>
            <motion.div animate={{ y: [0,6,0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
              <ChevronDown size={20} style={{ color: '#00f0ff', filter: 'drop-shadow(0 0 4px #00f0ff88)' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
