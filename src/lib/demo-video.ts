import { z } from 'zod';

const settings = z.object({
  approved: z.boolean(),
  watchUrl: z.string().max(500),
  title: z.string().min(1).max(120),
  captionLanguage: z
    .string()
    .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
    .max(35),
  transcriptUrl: z.string().max(500),
});
export type DemoVideoDefinition = {
  provider: 'YouTube' | 'Vimeo';
  title: string;
  watchUrl: string;
  embedUrl: string;
  transcriptUrl: string | null;
};

// Only an owner-reviewed, committed configuration can publish a video.
// No query string, user input or unapproved URL controls an iframe.
export function resolveDemoVideo(input: unknown): DemoVideoDefinition | null {
  const config = settings.parse(input);
  if (!config.approved) return null;
  const url = new URL(config.watchUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
    throw Error('The approved demo must use an ordinary HTTPS video-host URL.');
  let video: Pick<DemoVideoDefinition, 'provider' | 'watchUrl' | 'embedUrl'>;
  const youtube = ['www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];
  if (youtube.includes(url.hostname)) {
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : /^\/(?:embed|shorts)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw Error('Use a single approved YouTube video URL.');
    const embed = new URL('https://www.youtube-nocookie.com/embed/' + id);
    embed.search = new URLSearchParams({
      cc_load_policy: '1',
      cc_lang_pref: config.captionLanguage,
      playsinline: '1',
      rel: '0',
    }).toString();
    video = {
      provider: 'YouTube',
      watchUrl: 'https://www.youtube.com/watch?v=' + id,
      embedUrl: embed.href,
    };
  } else if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
    const match = /^\/(?:video\/)?([0-9]{6,12})(?:\/([a-fA-F0-9]{6,64}))?\/?$/.exec(url.pathname);
    if (!match) throw Error('Use a single approved Vimeo video URL.');
    const hash = match[2] || url.searchParams.get('h');
    if (hash && !/^[a-fA-F0-9]{6,64}$/.test(hash))
      throw Error('Invalid Vimeo unlisted-video identifier.');
    const embed = new URL('https://player.vimeo.com/video/' + match[1]);
    embed.search = new URLSearchParams({
      dnt: '1',
      texttrack: config.captionLanguage,
      ...(hash ? { h: hash } : {}),
    }).toString();
    video = {
      provider: 'Vimeo',
      watchUrl: 'https://vimeo.com/' + match[1] + (hash ? '/' + hash : ''),
      embedUrl: embed.href,
    };
  } else
    throw Error('The demo host must be approved YouTube or Vimeo; review other hosts separately.');
  let transcript: string | null = null;
  if (config.transcriptUrl) {
    const target = new URL(config.transcriptUrl);
    if (target.protocol !== 'https:' || target.username || target.password)
      throw Error('The transcript must use a public HTTPS URL.');
    transcript = target.href;
  }
  return { ...video, title: config.title, transcriptUrl: transcript };
}
