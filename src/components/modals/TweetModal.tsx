'use client';

import { useState, useEffect } from 'react';

interface TweetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTweet: (url: string) => { success: boolean; error?: string };
  isClaimed: boolean;
}

export default function TweetModal({
  isOpen,
  onClose,
  onSubmitTweet,
  isClaimed,
}: TweetModalProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = onSubmitTweet(url);
    if (res.success) {
      setSuccess(true);
      setError('');
    } else {
      setError(res.error || 'Submission failed');
    }
  };

  if (!isOpen) return null;

  const alreadyClaimed = isClaimed || success;

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tweet-modal-title"
    >
      <div className="modal-panel">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <h3 id="tweet-modal-title">Share the summons</h3>
        <p className="desc">
          Paste the link to your tweet about Nyx. Valid, original links earn 50
          wake points.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="tweet-url">
            Tweet link
          </label>
          <input
            id="tweet-url"
            className="field-input"
            type="url"
            placeholder="https://x.com/yourname/status/1234567890"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            disabled={alreadyClaimed}
            autoComplete="off"
            required
          />

          {error && <div className="field-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: '100%' }}
            disabled={alreadyClaimed}
          >
            {alreadyClaimed
              ? 'Tweet submitted'
              : 'Submit tweet (+50 wake points)'}
          </button>

          {alreadyClaimed && (
            <p className="field-success">Thanks — +50 wake points added.</p>
          )}
        </form>
      </div>
    </div>
  );
}
