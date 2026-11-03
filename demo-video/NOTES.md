# Final owner-review cut — verified specifications

Generated 2026-11-02T22:36:51.837283+00:00. **Unpublished and unapproved.** Source Production commit `3048806228fa167ad529c3020a7d3626ce232126`. This native-1080p cut follows the supplied Claude narrative; the older `.data/official-demo` files are preserved. No application, payment, memory or private-database action occurs during recording or rendering.

| File                        |      Bytes | Duration  | Resolution | Average fps | Video bitrate |
| --------------------------- | ---------: | --------- | ---------- | ----------- | ------------: |
| payguard-demo-final.mp4     | 45,238,338 | 165.000 s | 1920×1080  | 30/1        | 2,052,019 bps |
| payguard-demo-captioned.mp4 | 43,439,059 | 165.000 s | 1920×1080  | 30/1        | 1,964,782 bps |

Both exports contain **4,950 frames**, H.264 CRF 17, constant **30/1** nominal and average frame rate, yuv420p, AAC stereo at 48 kHz and an optional English `mov_text` subtitle track. The captioned cut additionally burns the same captions into the picture. AAC was encoded with a **192 kbps target**; the measured average is 132,333 bps over speech plus intentional reading silence. MP4 atom inspection confirms `moov` precedes `mdat` (faststart). This is **not a 4K export** and no upscaling claim is made.

## Voice, captions and audio

Microsoft **Edge TTS `en-US-GuyNeural`, rate −8%** supplied all narration. No ElevenLabs key/subscription or cloned voice was used. The exact provided base script is retained in `narration.txt`: 262 whitespace-separated words. Reading pauses fill the prescribed 165-second timeline instead of adding marketing copy or rushing speech. The judges section places its pauses between the demo, Connect and article sentences to match the screens.

There are **38 phrase-level cues**, at most **42 characters per line / two lines**. Their timings derive from the actual same-stream speech word events and exact inserted PCM samples, not guessed uniform offsets. SRT, VTT and burned ASS share these timings. Captions occupy the bottom safe band below the browser content.

Whole-program two-pass loudness normalization measured **-16.07 LUFS** integrated and **-4.50 dBTP** in the encoded final audio. The −1.5 dBTP setting is a ceiling, not a requirement to reach it. No music or unlicensed soundtrack is used. Silence detection reports intentional sentence and evidence-reading pauses; there is no silent black ending.

## Capture and evidence boundaries

- Real anonymous Production Chromium footage: **1920×1080 / device scale 1**, normal designed motion. Playwright's source WebM frame cadence is converted to constant 30 fps; a native-30-fps source claim is not made.
- Twenty-one focused pieces retain actual browser UI. Neutral chapter labels, gentle crops and the original-brand closing card are editorial elements. The HTTP 402 excerpt is visibly a document view of the original public reconciliation, not a live request or a fabricated wallet panel.
- The Courtroom is explicitly **Recorded replay of genuine SDK capture (2026-11-01)**. It is not fresh anonymous recall. OFF and ON both keep verification holds. Seven returned citations and four historical query tests are separate measures. Thirty-two records span the original owner and controlled tenant scopes.
- All three displayed payments are genuine **0.001 SUI** Mainnet receipts, Tatum-verified, with developer-controlled payer/merchant accounts and synthetic invoices. No additional payment was made for filming. The delivered analysis remains a hold, not supplier-payment approval.
- Human confirmation is labeled illustrative synthetic practice; no supplier phone call was recorded. PayGuard is decision support and sends no supplier payments. No FBI endorsement is implied.
- The direct FBI page did not render reliably. Its actual homepage guidance card and official link are used instead, as the storyboard permits. No explorer page was needed; the proof page and full recipient-credit reconciliation provide the authentic digests/effects.
- Private link prefetches and external telemetry POSTs were blocked by the capture guard. No Owner Sign In page, private workspace, personal challenge/signature, provider write or private Neon connection was opened by the video scripts.

## Validation and observed issues

All eight final scene segments decoded with no errors. **Zero black intervals and zero freeze events** were detected. Twenty-six opening/boundary/midpoint/final-frame stills plus focused detail frames were inspected, including the original citation/job/blob, synthetic confirmation, attack findings, three receipts and delivered report. The last frame retains the branded card and public links; the prior cut's black tail is absent.

Full-length offline Chromium playback at **1×** reached `ended=true`, time 165 seconds, for both files with **zero corrupt frames or media errors**. The two simultaneous software-rendered plays dropped about one-third of display frames while other validation/render jobs competed for WSL CPU. That is recorded honestly in `render/browser-playback.json`; it does not change the encoded 4,950-frame/30-fps streams. A separate complete single-cut playback reached the end with 180/4,950 display frames dropped (3.6%), zero corruption and zero media errors. Smooth Windows desktop playback and audible/creative acceptance still require the owner's review. Technical validation is not a claim of human approval.

The first review caught incomplete stylesheet loads in the opening and process shots. Those **two shots alone were recaptured** after adding explicit style readiness; all other valid footage was preserved. Transient WSL `ERR_NETWORK_CHANGED`, stalled hydration and a GitHub navigation timeout required bounded read-only pre-interaction reloads. Disabled controls were never forced. Original/rejected manifests and raw clips are preserved locally for comparison.

Review `preview.jpg`, `poster.png`, both MP4s and `demo.srt`. From the project folder in Ubuntu, run **`explorer.exe demo-video`**. Upload/publish/embed only after the owner has watched and approved the cut and supplied an approved public host URL. `src/content/demo-video.json` remains unapproved with no public video URL.

Windows can also open **`\\wsl.localhost\Ubuntu\home\sopski\payguard-ai\demo-video`** directly. The Explorer invocation returned code 1 without output, so its visible window was not independently confirmed; the files and Windows/WSL path are verified present.

## Reproducible tools

Node 22.23.1, existing Playwright 1.64.1 / tsx 4.23.15 and installed Chromium were reused. Python 3.12.3 uses an isolated `.venv` with pinned Pillow 13.0.0, imageio-ffmpeg 0.8.0 and edge-tts 7.3.1. imageio's FFmpeg n9.0.2 supplies H.264/AAC/ASS/drawtext; isolated ffprobe 7.0.2-static supplies inspection. The GPL-licensed fallback binaries came from the SHA-locked source in `scripts/ffmpeg.lock.json`. No apt/system install, paid subscription, app dependency upgrade or application-lockfile change was needed.

Run `bash demo-video/scripts/build.sh` for the capture/render/inspection pipeline. Run `node --import tsx demo-video/scripts/playback.ts` separately for a complete offline browser playback check. Generated media, tools, environments and preview images remain ignored rather than committed. The MP4 SHA-256 values and exact codecs are in [the committed technical summary](../docs/demo/final-review-validation.json); full logs/manifests remain in `render/` and `recordings/`.
