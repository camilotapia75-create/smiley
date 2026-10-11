'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '138', label: 'peer-reviewed\nstudies' },
  { value: '11K+', label: 'participants\nacross meta-analyses' },
  { value: '18%', label: 'lower mortality\nrisk' },
  { value: '30m', label: 'for cortisol to\nnormalize' },
];

const FACTS = [
  {
    emoji: '😊',
    title: 'Smiling nudges your mood — even when forced',
    highlights: ['138 studies', '11,000+ participants', 'd = 0.24–0.26'],
    body: 'A large meta-analysis across 138 studies and 11,000+ participants found facial expressions have a small but reliable effect on feelings. The Many Smiles Collaboration (2022) confirmed voluntarily posing a smile raised self-reported happiness by roughly 0.3–0.5 points on typical scales — comparable to viewing mildly pleasant images. Effects occurred even when people didn\'t expect them.',
    source: 'Psychological Bulletin · Nature Human Behaviour (2022)',
  },
  {
    emoji: '💓',
    title: 'Smiling during stress speeds heart-rate recovery',
    highlights: ['66–68 bpm vs 71–72 bpm', 'Duchenne smile', '170 participants'],
    body: 'Kraft & Pressman (2012, Psychological Science) had people hold chopsticks in a smile or neutral position during stressful tasks. All smiling groups showed lower heart rates during recovery — 66–68 bpm vs ~71–72 bpm for neutral. This held even when people were unaware they were smiling. Faster heart-rate recovery predicts better long-term cardiovascular outcomes.',
    source: 'Psychological Science (2012)',
  },
  {
    emoji: '🧘',
    title: 'Warm smiles help blunt the stress hormone cortisol',
    highlights: ['Cortisol at baseline in 30 min', 'HPA stress response', 'NIH-supported'],
    body: 'A 2018 NIH-supported study found that men who received genuine ("reward") or friendly ("affiliation") smiles from an evaluator returned to baseline cortisol within 30 minutes of a stressful speech. Those who received dominant or smirking expressions remained significantly elevated. Positive smiles actively buffered the HPA stress axis.',
    source: 'NIH / Psychoneuroendocrinology (2018)',
  },
  {
    emoji: '💚',
    title: 'Positive affect is linked to an ~18% lower mortality risk',
    highlights: ['HR = 0.82', '~18% lower risk', 'cardiovascular mortality'],
    body: 'Chida & Steptoe\'s quantitative review of prospective studies found higher positive psychological well-being associated with a combined hazard ratio of HR = 0.82 (95% CI 0.76–0.89) — an ~18% lower mortality risk in healthy populations. The association held for cardiovascular mortality and after adjusting for negative affect.',
    source: 'Psychosomatic Medicine (2008)',
  },
  {
    emoji: '🔬',
    title: 'Multiple physiological pathways link smiling to health',
    highlights: ['Polyvagal theory', 'Oculocardiac reflex', 'Stress buffering'],
    body: 'A 2023 review in Health Psychology Review synthesized evidence from natural and experimentally induced smiles, pointing to benefits for acute stress physiology, faster recovery, and reduced illness over time. Plausible mechanisms include increased positive affect, stronger social bonds, stress buffering (polyvagal theory, undoing hypothesis), and the oculocardiac reflex. Genuine Duchenne smiles — eyes and mouth — consistently show stronger effects.',
    source: 'Health Psychology Review (2023)',
  },
];

export default function ScienceTab({ accent }: { accent: string }) {
  return (
    <div className="px-5 pt-4 pb-24 flex flex-col gap-5">

      {/* Intro */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      >
        <h2 className="text-lg font-bold text-white mb-1">Why smiling works</h2>
        <p className="text-[13px] leading-relaxed" style={{ color: '#5b8dd9' }}>
          Evidence from peer-reviewed studies and meta-analyses. Effects are real but modest — smiling supports wellbeing, it doesn't replace it.
        </p>
      </motion.div>

      {/* Stat grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 gap-3"
      >
        {STATS.map((s, i) => (
          <div key={i} className="rounded-2xl p-4"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <p className="text-2xl font-extrabold tabular-nums leading-none mb-1.5"
              style={{ color: '#60a5fa' }}>
              {s.value}
            </p>
            <p className="text-[11px] leading-snug whitespace-pre-line" style={{ color: '#5b8dd9' }}>
              {s.label}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Fact cards */}
      {FACTS.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 + i * 0.05 }}
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Heading */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-xl mt-0.5">{f.emoji}</span>
            <p className="text-sm font-semibold text-white leading-snug">{f.title}</p>
          </div>

          {/* Highlight pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {f.highlights.map((h, j) => (
              <span key={j} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(37,99,235,0.18)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  color: '#93c5fd',
                }}>
                {h}
              </span>
            ))}
          </div>

          {/* Body */}
          <p className="text-[13px] leading-relaxed" style={{ color: '#7aacde' }}>{f.body}</p>

          {/* Source */}
          <p className="text-[10px] mt-3 font-medium" style={{ color: '#334155' }}>
            📄 {f.source}
          </p>
        </motion.div>
      ))}

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[11px] leading-relaxed" style={{ color: '#334155' }}>
          Genuine Duchenne smiles (eyes + mouth) produce stronger effects than mouth-only. Forced smiling is most effective as a brief mood nudge or recovery aid, not a long-term strategy. Individual responses vary.
        </p>
      </div>
    </div>
  );
}
