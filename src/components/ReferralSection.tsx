'use client';

import { useState, useEffect } from 'react';
import { ReferralHistoryItem } from '@/types';

import { formatAddress } from './Navbar';

interface ReferralSectionProps {
  walletAddress: string | null;
  referralCode: string | null;
  referralsCount: number;
  referralPoints: number;
  referredByCode: string | null;
  referralHistory: ReferralHistoryItem[];
  isConnecting?: boolean;
  connectError?: string | null;
  onConnectAndSign: () => Promise<{ success: boolean; error?: string }>;
  onRedeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
  onSimulateReferral: () => Promise<{ success: boolean; pts: number; address: string }>;
}

export function getReferralTier(count: number): { name: string; icon: string; nextTierCount: number } {
  if (count >= 30) return { name: "Nyx's Chosen", icon: '👑', nextTierCount: 30 };
  if (count >= 15) return { name: 'Harbinger of Dawn', icon: '☀️', nextTierCount: 30 };
  if (count >= 5) return { name: 'Circle Weaver', icon: '🕸️', nextTierCount: 15 };
  if (count >= 1) return { name: 'Dream Scout', icon: '🔭', nextTierCount: 5 };
  return { name: 'Dream Seeker', icon: '🌑', nextTierCount: 1 };
}

export default function ReferralSection({
  walletAddress,
  referralCode,
  referralsCount,
  referralPoints,
  referredByCode,
  referralHistory,
  isConnecting,
  connectError,
  onConnectAndSign,
  onRedeemCode,
  onSimulateReferral,
}: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [simulationToast, setSimulationToast] = useState<string | null>(null);
  const [autoRedeemAttempted, setAutoRedeemAttempted] = useState(false);

  const [origin, setOrigin] = useState('https://nyx.gg');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  // Auto-fill referral code from URL param (?ref=...) stored in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Also read ?ref= directly from current URL (in case user is on /dashboard?ref=...)
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get('ref');
    if (urlRef) {
      localStorage.setItem('nyx_pending_ref', urlRef.trim().toUpperCase());
    }
    const pending = localStorage.getItem('nyx_pending_ref');
    if (pending && !referredByCode) {
      setInputCode(pending);
    } else if (referredByCode) {
      // Already claimed — clear the stored code
      localStorage.removeItem('nyx_pending_ref');
    }
  }, [referredByCode]);

  // Auto-redeem once wallet is connected and a pending code is pre-filled
  useEffect(() => {
    if (autoRedeemAttempted) return;
    if (!walletAddress) return;
    if (referredByCode) {
      localStorage.removeItem('nyx_pending_ref');
      return;
    }
    const pending = localStorage.getItem('nyx_pending_ref');
    if (!pending || !inputCode) return;
    // Trigger auto-redeem
    setAutoRedeemAttempted(true);
    onRedeemCode(pending).then((res) => {
      setRedeemFeedback(res);
      if (res.success) {
        setInputCode('');
        localStorage.removeItem('nyx_pending_ref');
      }
    });
  }, [walletAddress, referredByCode, inputCode, autoRedeemAttempted, onRedeemCode]);


  const activeCode = referralCode || '';
  const shareUrl = `${origin}/?ref=${activeCode || 'SUMMON'}`;

  const currentTier = getReferralTier(referralsCount);

  const handleCopy = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleShareX = () => {
    if (!activeCode) return;
    const text = encodeURIComponent(
      `I am waking Nyx, the ancient god of sleep. 🌙\n\nEnter the dream circle and claim your wake points with my summon link:\n${shareUrl}\n\n#Nyx #Web3 #WakeNyx`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Join me in waking Nyx! Enter the dream circle here: ${shareUrl}`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const res = await onRedeemCode(inputCode);
    setRedeemFeedback(res);
    if (res.success) {
      setInputCode('');
    }
  };

  const handleSimulate = async () => {
    if (referralsCount >= 30) {
      setSimulationToast('Maximum referral cap reached (30 friends limit).');
      setTimeout(() => setSimulationToast(null), 3500);
      return;
    }
    const res = await onSimulateReferral();
    if (res.success) {
      setSimulationToast(`Friend joined (${res.address})! +${res.pts} points added to meter.`);
      setTimeout(() => setSimulationToast(null), 3500);
    } else if ((res as { error?: string }).error) {
      setSimulationToast((res as { error?: string }).error || 'Simulation failed');
      setTimeout(() => setSimulationToast(null), 3500);
    }
  };

  const tiers = [
    { name: 'Dream Scout', count: 1, reward: '+20 pts bonus', icon: '🔭' },
    { name: 'Circle Weaver', count: 5, reward: '+50 pts & FCFS boost', icon: '🕸️' },
    { name: 'Harbinger', count: 15, reward: '+100 pts & FCFS priority', icon: '☀️' },
    { name: "Nyx's Chosen", count: 30, reward: '+500 pts bonus (Max Circle Cap)', icon: '👑' },
  ];

  return (
    <section className="referral-section" id="referrals" aria-labelledby="referral-heading">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">Circle summons</p>
          <h2 id="referral-heading">The Referral Circle</h2>
          <p>
            Nyx only wakes when the entire circle gathers. Share your summon link
            to earn +10 wake points for every friend who joins, unlock exclusive
            circle tiers, and push your meter closer to the whitelist mint.
          </p>
        </div>

        {/* Top 3 Stat Cards */}
        <div className="referral-stats-grid">
          <div className="ref-stat-card">
            <span className="ref-stat-label">Friends Invited</span>
            <div className="ref-stat-value">
              <span className="ref-stat-number">{referralsCount}</span>
              <span className="ref-stat-icon">👥</span>
            </div>
            <span className="ref-stat-sub">
              {referralsCount >= 30 
                ? 'Max tier reached!' 
                : `${currentTier.nextTierCount - referralsCount} more to reach next tier`}
            </span>
          </div>

          <div className="ref-stat-card">
            <span className="ref-stat-label">Referral Points</span>
            <div className="ref-stat-value">
              <span className="ref-stat-number ref-gold">+{referralPoints}</span>
              <span className="ref-stat-icon">✦</span>
            </div>
            <span className="ref-stat-sub">+10 pts per verified invite (max 30 referrals)</span>
          </div>

          <div className="ref-stat-card">
            <span className="ref-stat-label">Circle Rank</span>
            <div className="ref-stat-value">
              <span className="ref-stat-number ref-tier">{currentTier.name}</span>
              <span className="ref-stat-icon">{currentTier.icon}</span>
            </div>
            <span className="ref-stat-sub">Community influence level</span>
          </div>
        </div>

        {/* Main Referral Content Grid */}
        <div className="referral-main-grid">
          {/* Left Column: Share Link & Quick Actions */}
          <div className="ref-card ref-share-card">
            <h3>Your Unique Summon Link</h3>
            <p className="ref-card-desc">
              Every dreamer who registers through your link increases your points
              and helps fill the community dream bar.
            </p>

            {!walletAddress ? (
              <div className="ref-connect-prompt">
                <div className="ref-connect-icon" aria-hidden="true">
                  🔒
                </div>
                <h4>Connect &amp; Sign Wallet to Unlock Your Link</h4>
                <p>
                  Your unique referral code is generated in the database after authenticating and signing with your wallet.
                </p>
                <button
                  type="button"
                  className="btn btn-gold ref-connect-cta"
                  onClick={onConnectAndSign}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <span className="live-dot" />
                      <span>Waiting for signature...</span>
                    </>
                  ) : (
                    <>
                      <span>🔗</span>
                      <span>Connect &amp; Sign Wallet</span>
                    </>
                  )}
                </button>
                {connectError && (
                  <p className="ref-feedback error" style={{ marginTop: '0.75rem' }}>
                    {connectError}
                  </p>
                )}
                <span className="ref-connect-sub">
                  Supports MetaMask, Rabby, Rainbow or instant demo connection.
                </span>
              </div>
            ) : (
              <>
                <div className="ref-wallet-badge">
                  <span className="ref-wallet-dot" />
                  <span>Verified Wallet: <strong>{formatAddress(walletAddress)}</strong></span>
                  {activeCode && <span className="ref-code-tag">{activeCode}</span>}
                </div>

                <div className="ref-link-box">
                  <div className="ref-link-input-wrap">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="ref-link-input"
                      aria-label="Your referral summon link"
                    />
                    <button
                      type="button"
                      className={`btn ref-copy-btn ${copied ? 'btn-gold' : 'btn-ghost'}`}
                      onClick={handleCopy}
                      aria-live="polite"
                    >
                      {copied ? (
                        <>
                          <span>✓</span>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <span>📋</span>
                          <span>Copy link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="ref-share-buttons">
                  <button
                    type="button"
                    className="btn ref-social-btn x-btn"
                    onClick={handleShareX}
                    aria-label="Share summon link on X"
                  >
                    <span className="x-icon">✕</span>
                    <span>Share on X</span>
                  </button>
                  <button
                    type="button"
                    className="btn ref-social-btn tg-btn"
                    onClick={handleShareTelegram}
                    aria-label="Share summon link on Telegram"
                  >
                    <span>✈</span>
                    <span>Telegram</span>
                  </button>
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      type="button"
                      className="btn ref-test-btn"
                      onClick={handleSimulate}
                      disabled={referralsCount >= 30}
                      title={referralsCount >= 30 ? 'Maximum referrals cap reached (30)' : 'Simulate a friend joining using your code to test live meter progression'}
                    >
                      <span>⚡</span>
                      <span>{referralsCount >= 30 ? 'Max Invites (30/30)' : 'Simulate invite (+10 pts)'}</span>
                    </button>
                  )}
                </div>

                {simulationToast && (
                  <div className="ref-toast-success animate-fade-in" role="status">
                    <span>✦</span>
                    <span>{simulationToast}</span>
                  </div>
                )}
              </>
            )}

            {/* Redeem Friend's Code Form */}
            <div className="ref-redeem-box">
              <h4>Were you invited by a dreamer?</h4>
              <p className="ref-redeem-desc">
                Enter your friend&apos;s code to claim an instant +10 wake points bonus.
              </p>

              {referredByCode ? (
                <div className="ref-claimed-badge">
                  <span>✓</span>
                  <span>Invite code <strong>{referredByCode}</strong> applied (+10 pts)</span>
                </div>
              ) : (
                <form onSubmit={handleRedeem} className="ref-redeem-form">
                  <input
                    type="text"
                    placeholder="e.g. NYX-8A2F"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="ref-code-input"
                    maxLength={12}
                    aria-label="Invite code"
                  />
                  <button type="submit" className="btn btn-gold ref-redeem-submit">
                    Claim +10 pts
                  </button>
                </form>
              )}

              {redeemFeedback && (
                <p className={`ref-feedback ${redeemFeedback.success ? 'success' : 'error'}`}>
                  {redeemFeedback.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Milestones & Recent Invites */}
          <div className="ref-card ref-milestone-card">
            <h3>Circle Milestones</h3>
            <p className="ref-card-desc">
              Unlock higher tier privileges as more dreamers enter through your summon.
            </p>

            <div className="milestone-ladder">
              {tiers.map((tier) => {
                const isUnlocked = referralsCount >= tier.count;
                return (
                  <div
                    key={tier.name}
                    className={`milestone-item ${isUnlocked ? 'unlocked' : ''}`}
                  >
                    <div className="milestone-badge" aria-hidden="true">
                      {isUnlocked ? '✓' : tier.icon}
                    </div>
                    <div className="milestone-info">
                      <div className="milestone-header">
                        <strong className="milestone-name">{tier.name}</strong>
                        <span className="milestone-count">{tier.count} friend{tier.count > 1 ? 's' : ''}</span>
                      </div>
                      <span className="milestone-reward">{tier.reward}</span>
                    </div>
                    {isUnlocked && (
                      <span className="milestone-tag">Unlocked</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recent Invites Log */}
            <div className="ref-history-wrap">
              <h4>Recent Circle Summons</h4>
              {referralHistory && referralHistory.length > 0 ? (
                <div className="ref-history-list">
                  {referralHistory.slice(0, 4).map((item) => (
                    <div key={item.id} className="ref-history-row">
                      <span className="ref-history-addr">{item.address} joined</span>
                      <span className="ref-history-pts">+{item.pts} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ref-empty-note">
                  No dreamers summoned yet. Copy your link above or click &ldquo;Simulate invite&rdquo; to test!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
