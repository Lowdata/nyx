'use client';

import { useState, useEffect } from 'react';
import Backdrop from '@/components/Backdrop';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Lore from '@/components/Lore';
import DreamMeter from '@/components/DreamMeter';
import Rituals from '@/components/Rituals';
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
    completeTask,
    connectWallet,
    generateReferralCode,
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

  return (
    <>
      <Backdrop glowPct={pct} />
      <SparkleBurst triggerKey={sparkleKey} />

      <Navbar
        walletAddress={state.walletAddress}
        onConnectWallet={() => {
          connectWallet();
          setSparkleKey((k) => k + 1);
        }}
      />

      <main>
        <Hero
          points={state.points}
          pct={pct}
          tasksDone={state.tasksDone}
          onCompleteTask={handleTaskComplete}
          referralCode={state.referralCode}
          onGenerateReferral={generateReferralCode}
        />

        <Lore />

        <DreamMeter points={state.points} pct={pct} stage={stage} />

        <Rituals
          onOpenSpin={() => setSpinOpen(true)}
          onOpenTweet={() => setTweetOpen(true)}
          remainingSpinMs={remainingSpinMs}
          isTweetClaimed={state.tweetClaimed}
        />

        <AwakenMint
          points={state.points}
          walletAddress={state.walletAddress}
          onConnectWallet={() => {
            connectWallet();
            setSparkleKey((k) => k + 1);
          }}
        />

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
