"""Inspect codecs, timeline, captions, black/freeze/silence events and representative frames."""
import pathlib,json,subprocess,re,concurrent.futures,hashlib,math
from PIL import Image,ImageDraw,ImageStat
import imageio_ffmpeg
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'render';FF=imageio_ffmpeg.get_ffmpeg_exe();PROBE=str(ROOT/'.tools/ffprobe');scenes=json.loads((ROOT/'scripts/scenes.json').read_text());frames=OUT/'review-frames';frames.mkdir(exist_ok=True)
report={'source':'Independent ffprobe/FFmpeg export inspection; owner creative approval is still required','files':[],'sceneChecks':[],'captionChecks':{},'noFinancialOperation':True}
for name in ['payguard-demo-final.mp4','payguard-demo-captioned.mp4']:
 p=ROOT/name;meta=json.loads(subprocess.check_output([PROBE,'-v','error','-show_streams','-show_format','-of','json',str(p)]));v=next(x for x in meta['streams'] if x['codec_type']=='video');a=next(x for x in meta['streams'] if x['codec_type']=='audio')
 if (v['width'],v['height'])!=(1920,1080) or v['r_frame_rate']!='30/1' or v['avg_frame_rate']!='30/1' or abs(float(meta['format']['duration'])-165)>.1 or v['pix_fmt']!='yuv420p' or a['codec_name']!='aac':raise RuntimeError('Export specification mismatch '+name)
 report['files'].append({'name':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'ffprobe':meta})
text=(ROOT/'demo.srt').read_text();cues=re.findall(r'(\d+)\n([^\n]+) --> ([^\n]+)\n(.*?)(?=\n\n|$)',text,re.S)
if not cues:raise RuntimeError('Missing captions')
for _,start,end,caption in cues:
 lines=caption.splitlines()
 if len(lines)>2 or any(len(line)>42 for line in lines):raise RuntimeError('Caption safe length exceeded')
report['captionChecks']={'cues':len(cues),'maximumLineLength':max(len(l) for c in cues for l in c[3].splitlines()),'maximumLines':max(len(c[3].splitlines()) for c in cues),'timing':'Word events from the same synthesized audio plus exact inserted PCM gaps; see timing-manifest.json'}
def inspect(s):
 r=subprocess.run([FF,'-hide_banner','-threads','2','-ss',str(s['start']),'-i',str(ROOT/'payguard-demo-captioned.mp4'),'-t',str(s['seconds']),'-vf','blackdetect=d=0.12:pix_th=0.10:pic_th=0.98,freezedetect=n=-60dB:d=2','-af','silencedetect=noise=-45dB:d=2','-f','null','-'],capture_output=True,text=True,timeout=120)
 if r.returncode:raise RuntimeError(r.stderr[-1000:])
 (OUT/(s['id']+'-inspection.log')).write_text(r.stderr)
 black=re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',r.stderr)
 freeze=[l.split(']')[-1].strip() for l in r.stderr.splitlines() if 'freeze_' in l]
 silence=[l.split(']')[-1].strip() for l in r.stderr.splitlines() if 'silence_' in l]
 if black:raise RuntimeError('Unexpected black frames in '+s['id']+': '+str(black))
 return {'scene':s['id'],'start':s['start'],'seconds':s['seconds'],'decodePassed':True,'blackIntervals':black,'freezeEvents':freeze,'silenceEvents':silence}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for row in pool.map(inspect,scenes):report['sceneChecks'].append(row);print('Inspected '+row['scene'],flush=True)
# Inspect both sides of every edit, opening frame, scene midpoints and the final frame.
times=sorted(set([0,.5,164.966]+[t for s in scenes for t in [s['start'],s['start']+s['seconds']/2,max(0,s['start']+s['seconds']-1/30)]]))
stills=[]
for i,t in enumerate(times):
 path=frames/f'{i:02}-{t:06.2f}.png';r=subprocess.run([FF,'-hide_banner','-v','error','-y','-ss',str(t),'-i',str(ROOT/'payguard-demo-captioned.mp4'),'-frames:v','1',str(path)],capture_output=True,text=True)
 if r.returncode or not path.exists():raise RuntimeError('Missing review frame')
 with Image.open(path) as image:
  stat=ImageStat.Stat(image.convert('RGB'));variance=sum(stat.stddev)/3
  if variance<8:raise RuntimeError('Blank/flat frame at '+str(t))
  tile=image.resize((480,270));stills.append((t,tile))
sheet=Image.new('RGB',(1920,math.ceil(len(stills)/4)*304),'#0d2833');draw=ImageDraw.Draw(sheet)
for i,(t,img) in enumerate(stills):x=(i%4)*480;y=(i//4)*304;sheet.paste(img,(x,y));draw.text((x+8,y+278),f'{t:06.2f}s',fill='#b8f7e4')
sheet.save(ROOT/'preview.jpg',quality=95)
# Final first/last frame, separately readable offline.
Image.open(frames/f'{len(times)-1:02}-{times[-1]:06.2f}.png').save(ROOT/'poster.png')
loud=subprocess.run([FF,'-hide_banner','-i',str(ROOT/'payguard-demo-final.mp4'),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True)
report['finalAudioLoudness']=json.loads(re.findall(r'\{[^{}]+"input_i"[^{}]+\}',loud.stderr,re.S)[-1]);report['boundaryFramesReviewed']=len(stills);report['lastFrameSeconds']=times[-1]
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print('Validated 165 seconds, CFR 30 fps, captions, audio, no black intervals, and all scene-boundary stills.',flush=True)
