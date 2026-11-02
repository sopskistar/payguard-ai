"""Video-only FFmpeg/ffprobe installation. No app configuration or private data access."""
import pathlib, urllib.request, tarfile, hashlib, json
root=pathlib.Path(__file__).resolve().parents[1];tools=root/'.tools';tools.mkdir(exist_ok=True)
url='https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
archive=tools/'ffmpeg-static.tar.xz'
if not archive.exists():urllib.request.urlretrieve(url,archive)
existing=tools.parent/'scripts/ffmpeg.lock.json'
if existing.exists():
 expected=json.loads(existing.read_text())['archiveSha256']
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise RuntimeError('Tool archive differs from the committed lock; review explicitly.')
with tarfile.open(archive) as package:
 for member in package.getmembers():
  if member.isfile() and pathlib.PurePosixPath(member.name).name in ['ffmpeg','ffprobe','GPLv3.txt','readme.txt']:
   target=tools/pathlib.PurePosixPath(member.name).name
   target.write_bytes(package.extractfile(member).read());target.chmod(0o755 if target.name.startswith('ff') else 0o644)
lock={'source':url,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'license':'GPL v3; binaries kept out of Git','binaries':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [tools/'ffmpeg',tools/'ffprobe']}}
(root/'scripts/ffmpeg.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
print('Isolated ffmpeg and ffprobe installed; no system packages or app dependencies changed.')
