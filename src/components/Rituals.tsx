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
          <p className="kicker">Extra charges</p>
          <h2 id="rituals-heading">Two rituals</h2>
          <p>
            One resets every day. The other only works once you&apos;ve actually
            posted about Nyx.
          </p>
        </div>

        <div className="ritual-grid">
          <div className="ritual-cta">
            <div className="icon" aria-hidden="true">
              🌙
            </div>
            <h3>Daily moon spin</h3>
            <p>
              One free spin, once every 24 hours. Land anywhere on the wheel and the
              points go straight into the meter.
            </p>
            <div className="cta-foot">
              <button
                type="button"
                className="btn btn-gold"
                id="open-spin"
                onClick={onOpenSpin}
              >
                {isCooldown
                  ? `Next spin in ${formatRemaining(remainingSpinMs)}`
                  : 'Spin now'}
              </button>
            </div>
          </div>

          <div className="ritual-cta">
            <div className="icon" aria-hidden="true">
              🕊️
            </div>
            <h3>Share the summons</h3>
            <p>
              Post about Nyx on X, then drop the link below. One valid, original
              tweet earns wake points.
            </p>
            <div className="cta-foot">
              <button
                type="button"
                className="btn btn-gold"
                id="open-tweet"
                onClick={onOpenTweet}
                disabled={isTweetClaimed}
              >
                {isTweetClaimed
                  ? 'Tweet link submitted (+50 pts)'
                  : 'Submit tweet link (+50 pts)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
