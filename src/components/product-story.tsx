'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  Check,
  FileText,
  LockKeyhole,
  Pause,
  Phone,
  Play,
  RotateCcw,
  ScanLine,
  BrainCircuit,
} from 'lucide-react';
import { useClientReady } from './client-ready';
const chapters = [
  {
    title: 'An ordinary invoice',
    label: 'Invoice arrives',
    detail:
      'Northstar Studio. Same monthly retainer. A familiar document is only the starting point.',
    icon: FileText,
  },
  {
    title: 'One important difference',
    label: 'Recipient changes',
    detail: 'The amount is unchanged. The destination on this new invoice is different.',
    icon: ArrowDown,
  },
  {
    title: 'Compare before trusting',
    label: 'Change detected',
    detail: 'PayGuard compares the proposed destination with the established supplier reference.',
    icon: ScanLine,
  },
  {
    title: 'The approval stops here',
    label: 'Approval held',
    detail:
      'A changed recipient requires an independent check. Invoice wording cannot lift this hold.',
    icon: LockKeyhole,
  },
  {
    title: 'A human checks the change',
    label: 'Verify independently',
    detail:
      'In this illustration, the reviewer calls the previously established supplier contact and records what was confirmed.',
    icon: Phone,
  },
  {
    title: 'The next review remembers why',
    label: 'Recall the correction',
    detail:
      'A confirmed policy can add the specific escalation to a later review. The recipient-change safeguard remains active.',
    icon: BrainCircuit,
  },
];
export function ProductStory() {
  const ready = useClientReady();
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const visible = useInView(root, { amount: 0.25 });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !visible || step === chapters.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 3200);
    return () => clearTimeout(timer);
  }, [playing, visible, step]);
  const current = chapters[step];
  const Icon = current.icon;
  const select = (next: number) => {
    setPlaying(false);
    setStep(next);
  };
  return (
    <section
      className="product-story"
      ref={root}
      aria-label="Interactive payment review illustration"
    >
      <div className="story-chrome">
        <span>
          <img src="/brand/icon.png" alt="" /> PAYGUARD VERIFY
        </span>
        <span className="story-synthetic">Synthetic illustration</span>
      </div>
      <div className="story-document">
        <div className="story-invoice-title">
          <span className="story-vendor">
            N<span>↗</span>
          </span>
          <div>
            <strong>Northstar Studio</strong>
            <small>Invoice NS-1048 · Monthly retainer</small>
          </div>
          <span className="story-amount">
            $1,250<small>USD</small>
          </span>
        </div>
        <div className="story-paper-line">
          <span>Design services · March</span>
          <span>01 item</span>
        </div>
        <div className="story-recipient trusted">
          <span>
            <Check size={13} /> Established destination
          </span>
          <code>
            0x1111<span>…</span>1111
          </code>
        </div>
        <motion.div
          className={`story-recipient proposed ${step >= 1 ? 'changed' : ''}`}
          animate={{
            borderColor: step >= 1 ? '#dfaf66' : '#293d4b',
            backgroundColor: step >= 1 ? '#322a1e' : '#12222e',
          }}
          transition={{ duration: reduced ? 0 : 0.35 }}
        >
          <span>Recipient on this invoice</span>
          <code>
            {step >= 1 ? '0x2222' : '0x1111'}
            <span>…</span>
            {step >= 1 ? '2222' : '1111'}
          </code>
          <AnimatePresence>
            {step >= 2 && (
              <motion.span
                className="story-change-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                CHANGED RECIPIENT
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
        <div className="story-decision-area">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step >= 5 ? 'memory' : step >= 4 ? 'human' : step >= 3 ? 'hold' : 'waiting'}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className={`story-decision ${step >= 4 ? 'human' : step >= 3 ? 'hold' : ''}`}
            >
              {step >= 5 ? (
                <>
                  <BrainCircuit size={21} />
                  <div>
                    <strong>Later review · remembered procedure</strong>
                    <small>Escalate repeated changes. Use the established contact.</small>
                    <small>Illustrated learning · real recall evidence below ↓</small>
                  </div>
                </>
              ) : step >= 4 ? (
                <>
                  <Phone size={21} />
                  <div>
                    <strong>Practice human verification recorded</strong>
                    <small>Known phone contact · exact instructions · expires in 30 days</small>
                  </div>
                </>
              ) : step >= 3 ? (
                <>
                  <LockKeyhole size={21} />
                  <div>
                    <strong>Approval held</strong>
                    <small>Independent recipient verification required</small>
                  </div>
                </>
              ) : (
                <>
                  <ScanLine size={21} />
                  <div>
                    <strong>
                      {step >= 2
                        ? 'Recipient mismatch detected'
                        : 'Review the payment instructions'}
                    </strong>
                    <small>
                      {step >= 2
                        ? 'Next: require an independent check'
                        : 'No approval or payment has been requested'}
                    </small>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="story-caption">
        <div className="story-caption-title">
          <span className="story-stage-icon">
            <Icon size={18} />
          </span>
          <span>0{step + 1} / 06</span>
          <h2>{current.title}</h2>
        </div>
        <p aria-live={playing && !reduced ? 'off' : 'polite'}>{current.detail}</p>
        <div className="story-progress" aria-hidden="true">
          <motion.span
            animate={{ width: `${((step + 1) / 6) * 100}%` }}
            transition={{ duration: reduced ? 0 : 0.4 }}
          />
        </div>
        <div className="story-controls">
          <button
            disabled={!ready}
            onClick={() => {
              if (step === 5) {
                setStep(0);
                setPlaying(true);
              } else setPlaying((p) => !p);
            }}
            aria-label={playing && step !== 5 ? 'Pause product story' : 'Play product story'}
          >
            {playing && step !== 5 ? <Pause size={14} /> : <Play size={14} />}{' '}
            {playing && step !== 5 ? 'Pause' : 'Play'}
          </button>
          <button
            disabled={!ready}
            onClick={() => {
              setStep(0);
              setPlaying(false);
            }}
          >
            <RotateCcw size={14} /> Replay
          </button>
          <span>
            {ready && reduced
              ? 'Reduced motion · manual steps below'
              : 'A six-step product illustration'}
          </span>
        </div>
      </div>
      <ol className="story-chapters" aria-label="Product story steps">
        {chapters.map((c, i) => (
          <li key={c.label}>
            <button
              disabled={!ready}
              onClick={() => select(i)}
              aria-current={step === i ? 'step' : undefined}
            >
              <span>{i + 1}</span>
              {c.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
