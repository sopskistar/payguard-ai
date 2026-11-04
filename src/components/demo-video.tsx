'use client';
import { useState } from 'react';
import config from '../content/demo-video.json';
import { resolveDemoVideo, type DemoVideoDefinition } from '@/lib/demo-video';

export function DemoVideoPlayer({ video }: { video: DemoVideoDefinition | null }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  if (!video) return null;
  return (
    <section className="demo-video" id="demo-video" aria-label="Official demo video">
      <span className="site-eyebrow">PRODUCT WALKTHROUGH · 2:46</span>
      <h2>{video.title}</h2>
      <p>Watch the recorded walkthrough, or explore the free interactive demo at your own pace.</p>
      <div className="demo-video-frame" aria-busy={loading}>
        {loaded ? (
          <iframe
            src={video.embedUrl}
            title={video.title}
            loading="lazy"
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setUnavailable(true);
            }}
          />
        ) : (
          <button
            type="button"
            className="demo-video-poster"
            onClick={() => {
              setLoading(true);
              setLoaded(true);
            }}
            aria-label={`Load ${video.title} on ${video.provider}`}
          >
            <img
              src="/demo-approved-poster.png"
              alt="PayGuard Verify. Verify before you pay. Remember what nearly went wrong."
              width={3840}
              height={2160}
              loading="lazy"
              decoding="async"
            />
            <span>
              Load video on {video.provider} <span aria-hidden="true">↗</span>
            </span>
          </button>
        )}
      </div>
      <p role="status" className="small-text muted">
        {loading
          ? `Opening the ${video.provider} player…`
          : unavailable
            ? `The embedded player could not load. Watch on ${video.provider} using the link below.`
            : `If the embedded player is blocked, watch on ${video.provider} using the link below.`}
      </p>
      <p className="demo-video-links">
        <a className="inline-link" href={video.watchUrl} target="_blank" rel="noreferrer">
          Watch on {video.provider} ↗
        </a>
        {video.transcriptUrl && (
          <a className="inline-link" href={video.transcriptUrl} target="_blank" rel="noreferrer">
            Read the transcript ↗
          </a>
        )}
      </p>
      <p className="small-text muted">
        The player loads only after your click. Use its CC controls for available captions.
        Synthetic business scenarios and genuine Mainnet evidence are identified separately in the
        walkthrough.
      </p>
    </section>
  );
}
export function DemoVideo() {
  return <DemoVideoPlayer video={resolveDemoVideo(config)} />;
}

export function DemoVideoLink() {
  const video = resolveDemoVideo(config);
  if (!video) return null;
  return (
    <p className="demo-video-links">
      <a className="inline-link" href={video.watchUrl} target="_blank" rel="noreferrer">
        Watch the 2:46 demo on {video.provider} ↗
      </a>
    </p>
  );
}
