import {it,expect,vi,afterEach} from 'vitest';
import {checkOrigin} from '@/lib/auth';
import {namespaceFor,memoryClient} from '@/lib/integrations/memory';
afterEach(()=>vi.unstubAllEnvs());
it('requires an exact trusted origin on writes',()=>{vi.stubEnv('APP_URL','https://verify.example');expect(()=>checkOrigin(new Request('https://verify.example/api/x',{headers:{origin:'https://verify.example'}}))).not.toThrow();for(const origin of ['https://evil.example','https://verify.example.evil.example','null'])expect(()=>checkOrigin(new Request('https://verify.example/api/x',{headers:{origin}}))).toThrow();expect(()=>checkOrigin(new Request('https://verify.example/api/x'))).toThrow();});
it('uses stable tenant-separated namespaces across sessions',()=>{expect(namespaceFor('owner-a')).toBe(namespaceFor('owner-a'));expect(namespaceFor('owner-a')).not.toBe(namespaceFor('owner-b'));expect(namespaceFor('owner-a')).not.toContain('owner-a');});
it('does not substitute local storage for Mainnet proof',()=>{vi.stubEnv('DATABASE_URL','');vi.stubEnv('MEMWAL_PRIVATE_KEY','synthetic');vi.stubEnv('MEMWAL_ACCOUNT_ID','synthetic');expect(()=>memoryClient('owner-a')).toThrow('not configured');});
