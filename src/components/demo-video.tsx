'use client';
import { useState } from 'react';
import config from '../content/demo-video.json';
import { resolveDemoVideo, type DemoVideoDefinition } from '@/lib/demo-video';

export function DemoVideoPlayer({ video }: { video: DemoVideoDefinition | null }) {
  const [loaded, setLoaded] = useState(false);
  if (!video) return null;
  return (
    <section className="demo-video" id="demo-video" aria-label="Official demo video">
      <span className="site-eyebrow">OWNER-APPROVED PRODUCT WALKTHROUGH</span>
      <h2>{video.title}</h2>
      <p>Watch the recorded walkthrough, or explore the free interactive demo at your own pace.</p>
      <div className="demo-video-frame">
        {loaded ? (
          <iframe
            src={video.embedUrl}
            title={video.title}
            loading="lazy"
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : (
          <button
            type="button"
            className="demo-video-poster"
            onClick={() => setLoaded(true)}
            aria-label={`Load ${video.title} on ${video.provider}`}
          >
            <img
              src="/demo-poster.svg"
              alt="Changed supplier instructions, a human verification hold, approved Walrus memory and independently verified receipts."
              width={1600}
              height={900}
            />
            <span>
              Load video on {video.provider} <span aria-hidden="true">↗</span>
            </span>
          </button>
        )}
      </div>
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
