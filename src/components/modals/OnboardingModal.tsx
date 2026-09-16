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
  onConnectTwitter?: (handle: string) => Promise<{ success: boolean; error?: string }>;
  onCompleteTask: (taskId: string, pts: number) => void;
  twitterDone: boolean;
  twitterHandle?: string | null;
  onRedeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
}

const BADGE_LABELS: Record<number, string> = {
  1: 'Connect wallet',
  2: 'Connect Twitter',
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
  onConnectTwitter,
  onCompleteTask,
  twitterDone,
  twitterHandle,
  onRedeemCode,
}: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [connectingLocal, setConnectingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [handleInput, setHandleInput] = useState('');
  const [handleConnecting, setHandleConnecting] = useState(false);
  const [handleSuccess, setHandleSuccess] = useState(false);

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

    try {
      turnstileWidgetId.current = (window as any).turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        appearance: 'interaction-only', // invisible unless needed
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      });
    } catch {
      // Widget error fallback
    }

    return () => {
      if (turnstileWidgetId.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(turnstileWidgetId.current);
        } catch {
          // Cleanup error ignored
        }
        turnstileWidgetId.current = null;
      }
    };
  }, [isOpen, step, turnstileReady]);

  // Clean widget on close
  useEffect(() => {
    if (!isOpen && turnstileWidgetId.current && (window as any).turnstile) {
      try {
        (window as any).turnstile.remove(turnstileWidgetId.current);
      } catch {
        // Cleanup error ignored
      }
      turnstileWidgetId.current = null;
      setTurnstileToken(null);
    }
  }, [isOpen]);

  // Strictly reset to step 1 whenever wallet is disconnected or modal is closed
  useEffect(() => {
    if (!walletAddress) {
      setStep(1);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setStep(1);
        setLocalError(null);
        setHandleConnecting(false);
        setHandleSuccess(false);
        setHandleInput('');
        setRefCode('');
        setRefFeedback(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // When wallet connects:
  // If Twitter is ALREADY connected, required setup is done -> close popup immediately!
  // Otherwise, advance to Step 2 (Connect Twitter)
  useEffect(() => {
    if (!isOpen || !walletAddress) return;

    if (twitterDone || twitterHandle) {
      // Twitter already linked — required onboarding complete, close modal immediately!
      onClose();
    } else if (step === 1) {
      const t = setTimeout(() => {
        setStep(2);
        setStepKey((k) => k + 1);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen, walletAddress, twitterDone, twitterHandle, step, onClose]);

  const handleConnect = async () => {
    setConnectingLocal(true);
    setLocalError(null);
    const res = await onConnectWallet(turnstileToken ?? undefined);
    setConnectingLocal(false);
    if (!res.success) {
      setLocalError(res.error || 'Connection failed. Try again.');
      // Safely reset Turnstile so user can retry
      if (turnstileWidgetId.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.reset(turnstileWidgetId.current);
        } catch {
          try { (window as any).turnstile.remove(turnstileWidgetId.current); } catch {}
          turnstileWidgetId.current = null;
        }
        setTurnstileToken(null);
      }
    }
  };

  const handleTwitterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handleInput.trim().replace(/^@/, '');
    if (!clean) {
      setLocalError('Please enter your X / Twitter handle');
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
      setLocalError('Handle can only contain letters, numbers, and underscores (max 15 chars)');
      return;
    }

    setHandleConnecting(true);
    setLocalError(null);

    if (onConnectTwitter) {
      const res = await onConnectTwitter(clean);
      setHandleConnecting(false);
      if (res.success) {
        setHandleSuccess(true);
        onCompleteTask('connectx', 50);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setLocalError(res.error || 'Failed to connect Twitter');
      }
    } else {
      setHandleConnecting(false);
      setHandleSuccess(true);
      onCompleteTask('connectx', 50);
      setTimeout(() => {
        onClose();
      }, 800);
    }
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

  const effectiveStep = !walletAddress ? 1 : step;

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
            🌙 Nyx awaits: complete setup to enter the dream
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

          {/* STEP 2 — Connect Twitter */}
          {effectiveStep === 2 && (
            <div className="ob-step-content" key={`s2-${stepKey}`}>
              <div className="ob-kicker">
                <span className="ob-kicker-dot" />
                Step 2 of 3
              </div>
              {(twitterDone || handleSuccess || twitterHandle) && (
                <div className="ob-success-check">✓ X Account Linked: +50 pts awarded!</div>
              )}
              <h2 className="ob-heading" id="ob-modal-title">Connect your Twitter</h2>
              <p className="ob-desc">
                Enter your <strong style={{ color: 'var(--cloud)' }}>@handle</strong> on X to link
                your profile and earn <strong style={{ color: 'var(--gold)' }}>+50 wake points</strong>.
              </p>

              <form onSubmit={handleTwitterSubmit} className="ob-handle-form">
                <div className="ob-handle-row">
                  <span className="ob-handle-at">@</span>
                  <input
                    type="text"
                    className="ob-handle-input"
                    placeholder="username"
                    value={handleInput}
                    onChange={(e) => {
                      setHandleInput(e.target.value);
                      setLocalError(null);
                    }}
                    maxLength={16}
                    disabled={handleConnecting || handleSuccess || !!twitterHandle}
                    autoComplete="off"
                    aria-label="Your X Twitter handle"
                  />
                  <button
                    type="submit"
                    className="ob-handle-btn"
                    disabled={handleConnecting || !handleInput.trim() || handleSuccess || !!twitterHandle}
                  >
                    {handleConnecting ? (
                      <span style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        border: '2px solid rgba(10,8,0,0.3)', borderTopColor: '#0a0800',
                        animation: 'spin 0.7s linear infinite', display: 'inline-block',
                      }} />
                    ) : handleSuccess || twitterHandle ? (
                      'Linked ✓'
                    ) : (
                      'Connect X'
                    )}
                  </button>
                </div>
              </form>

              {/* Quick follow option */}
              <div className="ob-follow-link-wrap">
                <a
                  href="https://twitter.com/intent/follow?screen_name=enternyx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ob-follow-sublink"
                >
                  <span>𝕏</span> Follow @enternyx on X ↗
                </a>
              </div>

              {localError && <p className="ob-error">{localError}</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ob-skip-link"
                  onClick={onClose}
                >
                  {handleSuccess || twitterHandle ? '✦ Enter the dream →' : 'I&apos;ll connect later →'}
                </button>
                <button
                  type="button"
                  className="ob-skip-link"
                  style={{ opacity: 0.65, fontSize: '0.78rem' }}
                  onClick={() => {
                    setStep(3);
                    setStepKey((k) => k + 1);
                  }}
                >
                  Have an invite code? →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Optional Referral */}
          {effectiveStep === 3 && (
            <div className="ob-step-content" key={`s3-${stepKey}`}>
              <div className="ob-kicker">
                <span className="ob-kicker-dot" />
                Step 3 of 3 (Optional)
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
                No code? Skip &amp; enter
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
