'use client';

import { useState, useEffect } from 'react';
import Backdrop from '@/components/Backdrop';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import DreamMeter from '@/components/DreamMeter';
import ReferralSection from '@/components/ReferralSection';
import Rituals from '@/components/Rituals';
import Lore from '@/components/Lore';
import AwakenMint from '@/components/AwakenMint';
import Footer from '@/components/Footer';
import SpinModal from '@/components/modals/SpinModal';
import TweetModal from '@/components/modals/TweetModal';
import SparkleBurst from '@/components/SparkleBurst';
import { useDreamState, FCFS_END } from '@/hooks/useDreamState';

export default function Home() {
  const {
    state,
    isLoaded,
    isConnecting,
    connectError,
    completeTask,
    connectAndSignWallet,
    disconnectWallet,
    redeemReferralCode,
    simulateFriendReferral,
    spinWheel,
    getRemainingSpinMs,
    submitTweet,
    markFcfsCelebrated,
    pct,
    stage,
  } = useDreamState();

  const [spinOpen, setSpinOpen] = useState(false);
  const [tweetOpen, setTweetOpen] = useState(false);
  const [remainingSpinMs, setRemainingSpinMs] = useState(0);
  const [sparkleKey, setSparkleKey] = useState(0);

  // Sync spin cooldown countdown
  useEffect(() => {
    if (!isLoaded) return;
    setRemainingSpinMs(getRemainingSpinMs());
    const interval = setInterval(() => {
      setRemainingSpinMs(getRemainingSpinMs());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoaded, getRemainingSpinMs]);

  // Check for FCFS milestone celebration
  useEffect(() => {
    if (!isLoaded) return;
    if (state.points >= FCFS_END && !state.fcfsCelebrated) {
      markFcfsCelebrated();
      setSparkleKey((k) => k + 1);
    }
  }, [isLoaded, state.points, state.fcfsCelebrated, markFcfsCelebrated]);

  const handleTaskComplete = (taskId: string, pts: number) => {
    completeTask(taskId, pts);
    setSparkleKey((k) => k + 1);
  };

  const handleSpinWin = (pts: number) => {
    spinWheel(pts);
    setSparkleKey((k) => k + 1);
  };

  const handleTweetSubmit = (url: string) => {
    const res = submitTweet(url);
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleRedeemReferral = async (code: string) => {
    const res = await redeemReferralCode(code);
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleSimulateReferral = async () => {
    const res = await simulateFriendReferral();
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleConnect = async () => {
    const res = await connectAndSignWallet();
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  return (
    <>
      <Backdrop glowPct={pct} />
      <SparkleBurst triggerKey={sparkleKey} />

      <Navbar
        walletAddress={state.walletAddress}
        isConnecting={isConnecting}
        onConnectWallet={handleConnect}
        onDisconnectWallet={disconnectWallet}
      />

      <main>
        {/* 1. Cinematic Summons Hero with Task List on the Left of the Image */}
        <Hero
          points={state.points}
          pct={pct}
          tasksDone={state.tasksDone}
          onCompleteTask={handleTaskComplete}
          referralCode={state.referralCode}
          onConnectWallet={handleConnect}
          onOpenSpin={() => setSpinOpen(true)}
          onOpenTweet={() => setTweetOpen(true)}
        />

        {/* 2. THE BIG DREAM METER (ON TOP) */}
        <DreamMeter points={state.points} pct={pct} stage={stage} />

        {/* 3. Full Referral Circle System */}
        <ReferralSection
          walletAddress={state.walletAddress}
          referralCode={state.referralCode}
          referralsCount={state.referralsCount || 0}
          referralPoints={state.referralPoints || 0}
          referredByCode={state.referredByCode}
          referralHistory={state.referralHistory || []}
          isConnecting={isConnecting}
          connectError={connectError}
          onConnectAndSign={handleConnect}
          onRedeemCode={handleRedeemReferral}
          onSimulateReferral={handleSimulateReferral}
        />

        {/* 4. Extra Rituals (Spin & Summons) */}
        <Rituals
          onOpenSpin={() => setSpinOpen(true)}
          onOpenTweet={() => setTweetOpen(true)}
          remainingSpinMs={remainingSpinMs}
          isTweetClaimed={state.tweetClaimed}
        />

        {/* 5. The Myth & Cycle */}
        <Lore />

        {/* 6. Awaken Mint & Whitelist Claim */}
        <AwakenMint
          points={state.points}
          walletAddress={state.walletAddress}
          onConnectWallet={handleConnect}
        />

        {/* 7. Footer */}
        <Footer />
      </main>

      <SpinModal
        isOpen={spinOpen}
        onClose={() => setSpinOpen(false)}
        onSpinWin={handleSpinWin}
        remainingMs={remainingSpinMs}
      />

      <TweetModal
        isOpen={tweetOpen}
        onClose={() => setTweetOpen(false)}
        onSubmitTweet={handleTweetSubmit}
        isClaimed={state.tweetClaimed}
      />
    </>
  );
}
