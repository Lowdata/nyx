'use client';

interface RitualsProps {
  onOpenSpin: () => void;
  onOpenTweet: () => void;
  remainingSpinMs: number;
  isTweetClaimed: boolean;
}

function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export default function Rituals({
  onOpenSpin,
  onOpenTweet,
  remainingSpinMs,
  isTweetClaimed,
}: RitualsProps) {
  const isCooldown = remainingSpinMs > 0;

  return (
    <section className="rituals" id="rituals" aria-labelledby="rituals-heading">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">Daily Blessings &amp; Bounties</p>
          <h2 id="rituals-heading">Two Rituals to Awaken Nyx</h2>
          <p>
            Supercharge your wake points beyond standard quests. Spin the celestial wheel daily
            and share your awakening on X.
          </p>
        </div>

        <div className="ritual-grid">
          {/* Ritual 1: Daily Moon Spin */}
          <div className="ritual-cta ritual-highlight-gold">
            <div className="ritual-card-badge gold">
              <span>⚡ Daily Ritual • 10 - 50 pts</span>
            </div>
            <div className="icon spin-icon" aria-hidden="true">
              🌙
            </div>
            <h3>Daily Moon Spin</h3>
            <p>
              Free spin once every 24 hours. Land anywhere on the celestial wheel and the
              points fly straight into your dream meter.
            </p>
            <div className="cta-foot">
              <button
                type="button"
                className={`btn ${isCooldown ? 'btn-ghost' : 'btn-gold'} ritual-action-btn`}
                id="open-spin"
                onClick={onOpenSpin}
              >
                {isCooldown ? (
                  <>
                    <span>⏳</span>
                    <span>Next spin in {formatRemaining(remainingSpinMs)}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Spin the Wheel (+10 to 50 pts)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Ritual 2: Share the Summons */}
          <div className="ritual-cta ritual-highlight-violet">
            <div className="ritual-card-badge violet">
              <span>🕊️ Social Bounty • +50 pts</span>
            </div>
            <div className="icon tweet-icon" aria-hidden="true">
              🕊️
            </div>
            <h3>Share the Summons</h3>
            <p>
              Post about Nyx on X with the summons prophecy, then submit the tweet URL
              to claim an instant bounty.
            </p>
            <div className="cta-foot">
              <button
                type="button"
                className={`btn ${isTweetClaimed ? 'btn-ghost' : 'btn-gold'} ritual-action-btn`}
                id="open-tweet"
                onClick={onOpenTweet}
                disabled={isTweetClaimed}
              >
                {isTweetClaimed ? (
                  <>
                    <span>✓</span>
                    <span>Tweet Reward Claimed (+50 pts)</span>
                  </>
                ) : (
                  <>
                    <span>𝕏</span>
                    <span>Submit Tweet Link (+50 pts)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
