# Official demo — new owner-review package

The new cut follows the owner's supplied Claude storyboard and exact base narration. It uses anonymous **public, read-only Production footage**, original branding and genuine saved evidence. No wallet connection/signature, payment, supplier write, memory write or private Neon read occurs in the recording pipeline. Publication is **not approved**.

## Local review files

- `demo-video/payguard-demo-final.mp4` — clean native-1080p cut, optional English soft subtitles.
- `demo-video/payguard-demo-captioned.mp4` — same timeline with burned high-contrast captions.
- [SRT captions](../../demo-video/demo.srt), [exact narration](../../demo-video/narration.txt), [shot plan](../../demo-video/storyboard.md), [public evidence links](../../demo-video/evidence-links.md), [actual validation and limitations](../../demo-video/NOTES.md).
- `demo-video/preview.jpg` — scene-boundary contact sheet; `poster.png` — closing-frame still. Both remain local until review.
- `demo-video/recordings/capture-manifest.json` — Production source SHA, original clips, timestamps, crop centers and read-only guard results.
- `demo-video/render/export-manifest.json` and `validation.json` — checksums, complete ffprobe output, audio levels, black/freeze/silence inspection and decoded segment checks.

[Committed final technical summary](final-review-validation.json) includes the actual MP4 checksums and measured audio/video results without publishing the media.

From Ubuntu/WSL in the project folder, run **`explorer.exe demo-video`** to open the files in Windows. The clean and captioned MP4s play offline. Watch both before approving publication; metadata and stills alone cannot establish creative acceptance.

## Reproduce

Run `bash demo-video/scripts/build.sh`. The package reuses the existing compatible Node/Playwright/tsx installation and Chromium; Python dependencies and FFmpeg/ffprobe are isolated and pinned under `demo-video/`. The application lockfile is unchanged. [Capture script](../../demo-video/scripts/record.ts) blocks private routes/APIs and non-read requests. Generated recordings, environments, tools and MP4s are ignored, never committed.

Source is 1920×1080, device scale 1, exported H.264 CRF 17 at constant 30 fps, yuv420p and AAC 192 kbps with faststart. No upscaled-4K claim is made. Microsoft Edge TTS `en-US-GuyNeural` supplies the narration; no ElevenLabs subscription/key is required or claimed. Word-boundary events from the same speech stream drive phrase-level captions and measured pauses.

The Courtroom is a **November 1 recorded replay**, not a fresh anonymous Mainnet recall. OFF and ON both retain the hold. Three genuine owner-controlled payments and synthetic invoices are disclosed. The FBI reference paraphrases [independent-verification guidance](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise) without endorsement. Public original approval evidence is a labeled document excerpt, not a fabricated signing event.

## Preserved previous cut

The original `.data/official-demo/payguard-verify-official-demo-4k.mp4` and `payguard-verify-official-demo-1080p.mp4` are preserved. Their [old technical manifest](technical-manifest.json), [old verification](verification.json), transcript and captions remain historical artifacts. The [independent November 2 audit](../INDEPENDENT_DEMO_AND_RELEASE_AUDIT_2026-11-02.md) found a black tail in that cut despite its earlier decode checks. Those files are **not the final recommended review package**. The new pipeline explicitly checks every scene, final frames and black intervals.

## Approval and submission

After viewing, the owner can upload the approved cut to an embedding-enabled public/unlisted YouTube or owner-approved Vimeo page, upload captions, check CC/playback and supply the final URL. Follow [the existing publication instructions](../DEMO_SCRIPT.md#publishing-the-approved-video). `src/content/demo-video.json` deliberately remains `approved: false`, with no placeholder player published.

[Live app](https://payguard-ai-henna.vercel.app/) · [Free walkthrough](https://payguard-ai-henna.vercel.app/try) · [Courtroom](https://payguard-ai-henna.vercel.app/courtroom) · [Payment proof](https://payguard-ai-henna.vercel.app/proof) · [Article](https://sopskistar.github.io/payguard-ai/) · [Repository](https://github.com/sopskistar/payguard-ai). [Submission requirements and owner identifiers](../SUBMISSION_HANDOFF.md). Deadline: November 10, 17:00 UTC. No submission form has been sent.
