'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';

interface OnboardingModalProps {
  isOpen: boolean;
  isReprompt: boolean;
  onClose: () => void;
  walletAddress: string | null;
  isConnecting: boolean;
  connectError: string | null;
  onConnectWallet: (turnstileToken?: string) => Promise<{ success: boolean; error?: string }>;
  onCompleteTask: (taskId: string, pts: number) => void;
  twitterDone: boolean;
  onRedeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
}

const BADGE_LABELS: Record<number, string> = {
  1: 'Connect wallet',
  2: 'Follow on X',
  3: 'Invite code',
};

export default function OnboardingModal({
  isOpen,
  isReprompt,
  onClose,
  walletAddress,
  isConnecting,
  connectError,
  onConnectWallet,
  onCompleteTask,
  twitterDone,
  onRedeemCode,
}: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [connectingLocal, setConnectingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [twitterOpened, setTwitterOpened] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [refCode, setRefCode] = useState('');
  const [refFeedback, setRefFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  // Cloudflare Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Render the Turnstile invisible widget when the modal opens on step 1
  useEffect(() => {
    if (!isOpen || step !== 1 || !turnstileReady) return;
    if (turnstileWidgetId.current) return; // already rendered
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileContainerRef.current || !(window as any).turnstile) return;

    turnstileWidgetId.current = (window as any).turnstile.render(turnstileContainerRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      appearance: 'interaction-only', // invisible unless needed
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(null),
      'error-callback': () => setTurnstileToken(null),
    });
  }, [isOpen, step, turnstileReady]);

  // Reset widget on close
  useEffect(() => {
    if (!isOpen && turnstileWidgetId.current && (window as any).turnstile) {
      (window as any).turnstile.reset(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
      setTurnstileToken(null);
    }
  }, [isOpen]);

  // Advance to step 2 when wallet connects
  useEffect(() => {
    if (walletAddress && step === 1 && isOpen) {
      const t = setTimeout(() => { setStep(2); setStepKey(k => k + 1); }, 600);
      return () => clearTimeout(t);
    }
  }, [walletAddress, step, isOpen]);

  // Advance to step 3 when twitter done
  useEffect(() => {
    if (twitterDone && step === 2 && isOpen) {
      const t = setTimeout(() => { setStep(3); setStepKey(k => k + 1); }, 600);
      return () => clearTimeout(t);
    }
  }, [twitterDone, step, isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
      setTwitterOpened(false);
      setCountdown(10);
      setRefCode('');
      setRefFeedback(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [isOpen]);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(10);
    countdownRef.current = setInterval(() => {
      let isFinished = false;
      setCountdown((c) => {
        if (c <= 1) {
          isFinished = true;
          return 0;
        }
        return c - 1;
      });

      if (isFinished) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setTimeout(() => {
          onCompleteTask('follow', 30);
          setStep(3);
          setStepKey((k) => k + 1);
        }, 0);
      }
    }, 1000);
  }, [onCompleteTask]);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const handleConnect = async () => {
    setConnectingLocal(true);
    setLocalError(null);
    const res = await onConnectWallet(turnstileToken ?? undefined);
    setConnectingLocal(false);
    if (!res.success) {
      setLocalError(res.error || 'Connection failed. Try again.');
      // Reset Turnstile so user can retry
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken(null);
      }
    }
  };

  const handleOpenTwitter = () => {
    window.open('https://twitter.com/intent/follow?screen_name=enternyx', '_blank', 'noopener,noreferrer');
    setTwitterOpened(true);
    startCountdown();
  };

  const handleRedeemRef = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = refCode.trim().toUpperCase();
    if (!clean) return;
    setRefLoading(true);
    setRefFeedback(null);
    const res = await onRedeemCode(clean);
    setRefFeedback({ ok: res.success, msg: res.message });
    setRefLoading(false);
    if (res.success) setTimeout(() => onClose(), 1200);
  };

  const effectiveStep = walletAddress ? Math.max(step, 2) : step;
  const dashOffset = twitterOpened ? ((10 - countdown) / 10) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div
      className={`ob-backdrop ${isOpen ? 'ob-open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-modal-title"
    >
      <div className="ob-panel">
        {isReprompt && (
          <div className="ob-reprompt-notice" aria-hidden="true">
            🌙 Nyx awaits — complete setup to enter the dream
          </div>
        )}

        {/* ── Left: Full-bleed art ── */}
        <div className="ob-art-side" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nyx_art.jpg" alt="" className="ob-art-img" draggable={false} />
          {/* Gradient fades into content panel */}
          <div className="ob-art-fade" />
          <div className="ob-art-fade-bottom" />
          {/* Step badge floating on art */}
          <div className="ob-art-badge">
            <span className="ob-art-badge-dot" />
            {BADGE_LABELS[effectiveStep] || 'Setup'}
          </div>
        </div>

        {/* ── Right: Step content ── */}
        <div className="ob-content-side">
          <button type="button" className="ob-close-btn" onClick={onClose} aria-label="Close">✕</button>

          {/* STEP 1 — Connect Wallet */}
          {effectiveStep === 1 && (
            <div className="ob-step-content" key={`s1-${stepKey}`}>
              <div className="ob-kicker">
                <span className="ob-kicker-dot" />
                Step 1 of 3
              </div>
              <h2 className="ob-heading" id="ob-modal-title">
                Nyx stirs in the darkness...
              </h2>
              <p className="ob-desc">
                Connect your wallet to enter the dream circle and claim your
                first <strong style={{ color: 'var(--gold)' }}>50 wake points</strong>.
              </p>
              <div className="ob-wallet-icons">
                <span className="ob-wallet-icon-chip">🦊 MetaMask</span>
                <span className="ob-wallet-icon-chip">👻 Phantom</span>
                <span className="ob-wallet-icon-chip">🐰 Rabby</span>
              </div>
              <button
                type="button"
                id="ob-connect-btn"
                className="ob-action-btn ob-btn-primary"
                onClick={handleConnect}
                disabled={connectingLocal || isConnecting}
              >
                {connectingLocal || isConnecting ? (
                  <>
                    <span style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      border: '2px solid rgba(10,8,0,0.3)', borderTopColor: '#0a0800',
                      animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0,
                    }} />
                    Waiting for signature...
                  </>
                ) : <>🔗 Connect &amp; Sign Wallet</>}
              </button>
              {(localError || connectError) && <p className="ob-error">{localError || connectError}</p>}

              {/* Cloudflare Turnstile — invisible bot challenge mounts here */}
              <div ref={turnstileContainerRef} style={{ marginTop: '8px' }} />
            </div>
          )}

          {/* Cloudflare Turnstile script — loads once globally */}
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="lazyOnload"
            onLoad={() => setTurnstileReady(true)}
          />

          {/* STEP 2 — Follow on X */}
          {effectiveStep === 2 && (
            <div className="ob-step-content" key={`s2-${stepKey}`}>
              <div className="ob-kicker">
                <span className="ob-kicker-dot" />
                Step 2 of 3
              </div>
              {twitterDone && (
                <div className="ob-success-check">✓ @enternyx followed — +30 pts awarded!</div>
              )}
              <h2 className="ob-heading" id="ob-modal-title">Follow the prophecy</h2>
              <p className="ob-desc">
                Follow <strong style={{ color: 'var(--cloud)' }}>@enternyx</strong> on X to
                earn <strong style={{ color: 'var(--gold)' }}>+30 pts</strong>. Click below,
                follow, and we&apos;ll mark it done automatically in 10 seconds.
              </p>
              {!twitterDone && (
                <>
                  <button
                    type="button"
                    id="ob-twitter-btn"
                    className="ob-action-btn ob-btn-x"
                    onClick={handleOpenTwitter}
                    disabled={twitterOpened}
                  >
                    <span style={{ fontWeight: 900, fontSize: '1.1em' }}>𝕏</span>
                    {twitterOpened ? 'Opened X — counting down...' : 'Follow @enternyx on X'}
                  </button>
                  {twitterOpened && (
                    <div className="ob-countdown-wrap">
                      <svg className="ob-countdown-ring" viewBox="0 0 36 36">
                        <circle className="ob-countdown-track" cx="18" cy="18" r="15.9" />
                        <circle className="ob-countdown-fill" cx="18" cy="18" r="15.9"
                          style={{ strokeDashoffset: dashOffset }} />
                      </svg>
                      <div className="ob-countdown-text">
                        Auto-completing in <strong>{countdown}s</strong><br />
                        <span style={{ fontSize: '0.73rem' }}>Already followed? We&apos;ve got you.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                className="ob-skip-link"
                onClick={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  setStep(3); setStepKey(k => k + 1);
                }}
              >
                I&apos;ll follow later →
              </button>
            </div>
          )}

          {/* STEP 3 — Optional Referral */}
          {effectiveStep === 3 && (
            <div className="ob-step-content" key={`s3-${stepKey}`}>
              <div className="ob-kicker">
                <span className="ob-kicker-dot" />
                Step 3 of 3 — Optional
              </div>
              <h2 className="ob-heading" id="ob-modal-title">Were you summoned?</h2>
              <p className="ob-desc">
                If a dreamer shared their link, enter their code to claim{' '}
                <strong style={{ color: 'var(--gold)' }}>+10 bonus points</strong>.
              </p>
              <form onSubmit={handleRedeemRef}>
                <div className="ob-ref-row">
                  <input
                    type="text"
                    className="ob-ref-input"
                    placeholder="e.g. NYX-8A2F"
                    value={refCode}
                    onChange={e => setRefCode(e.target.value)}
                    maxLength={12}
                    aria-label="Referral invite code"
                    autoComplete="off"
                    disabled={refLoading}
                  />
                  <button type="submit" className="ob-ref-submit" disabled={refLoading || !refCode.trim()}>
                    {refLoading ? '...' : 'Claim'}
                  </button>
                </div>
                {refFeedback && (
                  <p className={`ob-ref-feedback ${refFeedback.ok ? 'ok' : 'err'}`}>{refFeedback.msg}</p>
                )}
              </form>
              <button type="button" className="ob-action-btn ob-btn-primary"
                style={{ marginTop: '18px' }} onClick={onClose}>
                ✦ Enter the dream →
              </button>
              <button type="button" className="ob-skip-link" onClick={onClose}>
                No code — skip &amp; enter
              </button>
            </div>
          )}

          {/* Step Orbs */}
          <div className="ob-orbs" aria-hidden="true">
            {[1, 2, 3].map(s => (
              <div key={s} className={`ob-orb ${s < effectiveStep ? 'ob-orb-done' : s === effectiveStep ? 'ob-orb-active' : ''}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
