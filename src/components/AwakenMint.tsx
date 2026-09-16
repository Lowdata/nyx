'use client';

import { useState } from 'react';
import { TARGET, SLEEP_END, FCFS_END } from '@/hooks/useDreamState';

interface AwakenMintProps {
  points: number;
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function AwakenMint({
  points,
  walletAddress,
  onConnectWallet,
}: AwakenMintProps) {
  const [claimed, setClaimed] = useState(false);

  const isFcfsOpen = points >= FCFS_END;
  const isStirring = points >= SLEEP_END && points < FCFS_END;

  let pillText = '🌑 Locked: Nyx is still dreaming';
  let title = 'The mint is still dreaming.';
  let sub = 'Keep the meter climbing. Once it clears the Sleep tier, FCFS spots open up.';
  let fine = '';

  if (isFcfsOpen) {
    pillText = '🌗 FCFS open';
    title = 'FCFS spots are open.';
    sub = 'You helped clear the Sleep tier. Guaranteed spots only fill once the whole circle’s total gets there together.';
    fine = `Guaranteed: ${Math.max(0, points - FCFS_END)} / ${TARGET - FCFS_END} pts toward this tier (community-wide, not solo).`;
  } else if (isStirring) {
    pillText = '🌗 Stirring';
    title = 'Almost at FCFS.';
    sub = `${FCFS_END - points} more points clears the Sleep tier and opens FCFS spots.`;
  }

  const handleClaim = () => {
    if (!walletAddress) {
      onConnectWallet();
      return;
    }
    setClaimed(true);
  };

  return (
    <section className="awaken" id="awaken" aria-labelledby="awaken-heading">
      <div className="wrap">
        <div className="awaken-card" id="awaken-card">
          <div className="status-pill" id="status-pill">
            {pillText}
          </div>
          <h2 id="awaken-heading">{title}</h2>
          <p id="awaken-sub">{sub}</p>

          {isFcfsOpen && (
            <button
              type="button"
              className="btn btn-gold"
              id="mint-cta"
              onClick={handleClaim}
              disabled={claimed}
            >
              {claimed
                ? '✓ Spot Secured for Nyx Mint'
                : walletAddress
                ? 'Claim your FCFS spot'
                : 'Connect wallet to claim'}
            </button>
          )}

          {fine && <p className="fine">{fine}</p>}
        </div>
      </div>
    </section>
  );
}
