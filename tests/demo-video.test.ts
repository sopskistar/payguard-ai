import { describe, expect, it } from 'vitest';
import config from '@/content/demo-video.json';
import { resolveDemoVideo } from '@/lib/demo-video';
import nextConfig from '../next.config';

const approved = { ...config, approved: true, watchUrl: 'https://youtu.be/TESTVIDEO01' };
describe('owner-approved demo configuration', () => {
  it('keeps an unapproved video unpublished even when a URL has been entered', () => {
    expect(resolveDemoVideo({ ...approved, approved: false })).toBeNull();
  });
  it.each([
    'https://youtu.be/TESTVIDEO01?si=tracking',
    'https://www.youtube.com/watch?v=TESTVIDEO01&list=ignored',
    'https://www.youtube.com/embed/TESTVIDEO01',
  ])(
    'canonicalizes a single YouTube URL without carrying tracking or playlist values: %s',
    (watchUrl) => {
      const result = resolveDemoVideo({ ...approved, watchUrl })!;
      expect(result.watchUrl).toBe('https://www.youtube.com/watch?v=TESTVIDEO01');
      const embed = new URL(result.embedUrl);
      expect(embed.origin).toBe('https://www.youtube-nocookie.com');
      expect(embed.pathname).toBe('/embed/TESTVIDEO01');
      expect(embed.searchParams.get('cc_load_policy')).toBe('1');
      expect(embed.searchParams.get('cc_lang_pref')).toBe('en');
      expect(embed.searchParams.has('autoplay')).toBe(false);
      expect(embed.searchParams.has('list')).toBe(false);
    },
  );
  it('preserves an approved Vimeo unlisted identifier and requests captions', () => {
    const result = resolveDemoVideo({
      ...approved,
      watchUrl: 'https://vimeo.com/123456789/abcdef1234',
      transcriptUrl: 'https://example.org/approved-transcript',
    })!;
    const embed = new URL(result.embedUrl);
    expect(embed.origin).toBe('https://player.vimeo.com');
    expect(embed.searchParams.get('h')).toBe('abcdef1234');
    expect(embed.searchParams.get('texttrack')).toBe('en');
    expect(result.transcriptUrl).toBe('https://example.org/approved-transcript');
  });
  it.each([
    'http://youtu.be/TESTVIDEO01',
    'https://youtube.com.evil.example/watch?v=TESTVIDEO01',
    'https://user:password@youtube.com/watch?v=TESTVIDEO01',
    'https://www.youtube.com/redirect?q=https://example.org',
    'https://youtu.be/short',
    'javascript:alert(1)',
  ])('fails closed for an unsupported or ambiguous approved URL: %s', (watchUrl) => {
    expect(() => resolveDemoVideo({ ...approved, watchUrl })).toThrow();
  });
  it('rejects executable transcript URLs', () => {
    expect(() => resolveDemoVideo({ ...approved, transcriptUrl: 'javascript:alert(1)' })).toThrow();
  });
  it('permits only the supported frame hosts while retaining application anti-framing protection', async () => {
    const rules = await nextConfig.headers!();
    const csp = rules[0].headers.find((h) => h.key === 'Content-Security-Policy')!.value;
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com https://player.vimeo.com;');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
