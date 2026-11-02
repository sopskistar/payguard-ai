"""Deterministic 1080p edit from public footage + exact timed narration. No private app I/O."""
import pathlib,json,subprocess,wave,math,re,textwrap,hashlib
import imageio_ffmpeg
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'render';OUT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe();PROBE=str(ROOT/'.tools/ffprobe')
scenes=json.loads((ROOT/'scripts/scenes.json').read_text());capture=json.loads((ROOT/'recordings/capture-manifest.json').read_text())
def run(args,log=None):
 r=subprocess.run([FF,'-hide_banner','-y']+list(map(str,args)),capture_output=True,text=True)
 if log:(OUT/log).write_text(r.stderr)
 if r.returncode:raise RuntimeError(r.stderr[-2500:])
 return r
def stamp(t,ass=False):
 units=100 if ass else 1000;n=round(t*units);sec,frac=divmod(n,units);minute,s=divmod(sec,60);h,m=divmod(minute,60)
 return f'{h}:{m:02}:{s:02}.{frac:02}' if ass else f'{h:02}:{m:02}:{s:02},{frac:03}'
def norm(t):return re.sub(r'[^a-z0-9]','',t.lower())
all_cues=[];timing_report=[];pcm_all=bytearray();rate=48000
for s in scenes:
 name=s['id'];data=json.loads((OUT/(name+'-words.json')).read_text());events=data['words'];text=s['text'];positions=[i for i,c in enumerate(text) if re.match('[a-z0-9]',c,re.I)]
 if norm(''.join(e['text'] for e in events))!=norm(text):raise RuntimeError('Speech/source mismatch '+name)
 # Recover punctuation from the exact supplied script, aligning normalized characters to actual word events.
 cursor=0;previous=0
 for e in events:
  cursor+=len(norm(e['text']));end=positions[cursor] if cursor<len(positions) else len(text)
  e['sourceStart']=previous;e['sourceEnd']=end;previous=end
 raw=OUT/(name+'-raw.wav');run(['-loglevel','error','-i',OUT/(name+'.mp3'),'-ar',str(rate),'-ac','1','-c:a','pcm_s16le',raw])
 with wave.open(str(raw),'rb') as w:pcm=w.readframes(w.getnframes())
 speech_end=(events[-1]['offset']+events[-1]['duration'])/1e7
 lead=.18;tail=.25;spare=s['seconds']-lead-tail-speech_end
 if spare<-.02:raise RuntimeError('Speech does not fit without rushing: '+name)
 breaks=[]
 for i,e in enumerate(events[:-1]):
  phrase=text[e['sourceStart']:e['sourceEnd']].strip()
  if re.search(r'[.!?][’\'”"]?$',phrase):
   end=(e['offset']+e['duration'])/1e7;start=events[i+1]['offset']/1e7
   breaks.append((i,(end+start)/2))
 gap=min(1.15,max(0,spare*.65/max(1,len(breaks))))
 samples=bytearray(b'\0'*(round(lead*rate)*2));from_sample=0;insertions=[]
 for break_number,(index,point) in enumerate(breaks):
  pause=gap
  if name=='07-judges':
   # Match the supplied short narration to the actual Connect and article shots.
   # Put reading time between sentences, not in a nine-second silent tail.
   target=[8.1,16.4][break_number]
   pause=max(0,target-lead-events[index+1]['offset']/1e7-sum(x['seconds'] for x in insertions))
  cut=round(point*rate);samples.extend(pcm[from_sample*2:cut*2]);samples.extend(b'\0'*(round(pause*rate)*2));from_sample=cut;insertions.append({'afterWord':index,'atSourceSeconds':point,'seconds':pause})
 end_sample=round(min(len(pcm)/2/rate,speech_end+.14)*rate);samples.extend(pcm[from_sample*2:end_sample*2]);needed=s['seconds']*rate*2
 if len(samples)>needed:raise RuntimeError('Narration overflow '+name)
 samples.extend(b'\0'*(needed-len(samples)));pcm_all.extend(samples)
 def mapped(e,at_end=False):
  t=(e['offset']+(e['duration'] if at_end else 0))/1e7
  return lead+t+sum(x['seconds'] for x in insertions if x['atSourceSeconds']<=t)
 cues=[];first=0
 for i,e in enumerate(events):
  group=text[events[first]['sourceStart']:e['sourceEnd']].strip();lines=textwrap.wrap(group,width=42,break_long_words=False,break_on_hyphens=False)
  stop=(len(lines)>=2 and len(lines[-1])>=24) or i==len(events)-1 or bool(re.search(r'[.!?][’\'”"]?$',group))
  if i+1<len(events):
   following=text[events[first]['sourceStart']:events[i+1]['sourceEnd']].strip()
   if len(textwrap.wrap(following,width=42,break_long_words=False,break_on_hyphens=False))>2:stop=True
  if stop:
   if len(lines)>2 or any(len(l)>42 for l in lines):raise RuntimeError('Caption wrapping failure')
   a=mapped(events[first]);b=mapped(e,True)+.06
   if i+1<len(events):b=min(b,mapped(events[i+1])-.012)
   cues.append((a,b,'\n'.join(lines)));first=i+1
 all_cues.extend((s['start']+a,s['start']+b,t) for a,b,t in cues)
 timing_report.append({'scene':name,'providerVoice':data['voice'],'providerRate':data['rate'],'sourceSpeechEnd':speech_end,'finalSpeechEndInScene':mapped(events[-1],True),'intentionalTailReadingSeconds':s['seconds']-mapped(events[-1],True),'sceneSeconds':s['seconds'],'wordBoundaryEvents':len(events),'insertedMeasuredGaps':insertions,'captionTiming':'Matching speech-stream word offsets plus exact inserted PCM samples; no guessed offsets or rushed speech.'})
with wave.open(str(OUT/'narration-timed.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm_all)
# Whole-program two-pass loudness, not independent scene gain changes.
measure=run(['-i',OUT/'narration-timed.wav','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],'loudness-measure.log')
m=json.loads(re.findall(r'\{[^{}]+"input_i"[^{}]+\}',measure.stderr,re.S)[-1])
af=f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json"
run(['-i',OUT/'narration-timed.wav','-af',af,'-ar','48000','-ac','2','-c:a','pcm_s16le',OUT/'narration-normalized.wav'],'loudness-normalize.log')
srt='';vtt='WEBVTT\n\n'
ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,35,&H00FFFFFF,&H00FFFFFF,&H00101B20,&HC0061721,0,0,0,0,100,100,0,0,3,9,0,2,250,250,28,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
last=0
for i,(a,b,t) in enumerate(all_cues,1):
 if a<last-.005 or b<=a:raise RuntimeError('Overlapping or invalid caption interval')
 last=b;srt+=f'{i}\n{stamp(a)} --> {stamp(b)}\n{t}\n\n';vtt+=f'{stamp(a).replace(",",".")} --> {stamp(b).replace(",",".")}\n{t}\n\n';ass+=f'Dialogue: 0,{stamp(a,True)},{stamp(b,True)},Default,,0,0,0,,{t.replace(chr(10),r"\N")}\n'
(ROOT/'demo.srt').write_text(srt);(ROOT/'demo.vtt').write_text(vtt);(OUT/'captions.ass').write_text(ass)
(OUT/'timing-manifest.json').write_text(json.dumps(timing_report,indent=2)+'\n')
outputs=[]
for p in capture['pieces']:
 out=OUT/(p['id']+'-edit.mp4');outputs.append(out)
 # Reuse only a completed edit of these exact recorded inputs and camera settings.
 # A crash-created partial MP4 or a newly captured source must never be silently reused.
 key=hashlib.sha256(json.dumps({'recipe':1,'piece':p,'sourceBytes':pathlib.Path(p['path']).stat().st_size},sort_keys=True).encode()).hexdigest()
 keyfile=OUT/(p['id']+'-edit.key')
 if out.exists() and keyfile.exists() and keyfile.read_text().strip()==key:
  check=subprocess.run([PROBE,'-v','error','-show_entries','format=duration','-of','json',str(out)],capture_output=True,text=True)
  if check.returncode==0 and abs(float(json.loads(check.stdout)['format']['duration'])-p['seconds'])<.05:continue
 scene=scenes[p['scene']];seconds=p['seconds'];frames=seconds*30
 label=OUT/(p['id']+'-label.txt');label.write_text('Recorded replay of genuine SDK capture (2026-11-01)' if p['id']=='07-courtroom' else scene['label'])
 if p['route'].startswith('editorial:'):
  vf=f"fps=30,zoompan=z='1+0.005*on/{frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,setsar=1"
 else:
  # Smooth editorial camera on authentic footage; original UI content and theme are unchanged.
  z=p.get('zoom',1);z0=max(1,z-.06);cx=p['camera']['cx'];cy=p['camera']['cy']
  zoom=f'{z0}+({z+.008}-{z0})*(0.5-0.5*cos(PI*min(on/{frames},1)))'
  vf=f"fps=30,zoompan=z='{zoom}':x='max(0,min(iw-iw/zoom,{cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,{cy}-ih/zoom/2))':d=1:s=1600x900:fps=30,pad=1920:1080:160:55:color=0x0d2833,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile={label}:fontcolor=0xa6eddb:fontsize=23:x=160:y=18,setsar=1"
 run(['-ss',p['offset'],'-i',p['path'],'-t',seconds,'-an','-vf',vf,'-c:v','libx264','-preset','medium','-crf','17','-maxrate','12M','-bufsize','24M','-threads','4','-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-video_track_timescale','15360',out])
 keyfile.write_text(key+'\n')
 print('Edited '+p['id'],flush=True)
concat=OUT/'concat.txt';concat.write_text(''.join("file '"+p.as_posix()+"'\n" for p in outputs))
run(['-f','concat','-safe','0','-i',concat,'-c','copy',OUT/'picture-165.mp4'])
clean=ROOT/'payguard-demo-final.mp4';captioned=ROOT/'payguard-demo-captioned.mp4'
run(['-i',OUT/'picture-165.mp4','-i',OUT/'narration-normalized.wav','-i',ROOT/'demo.srt','-map','0:v:0','-map','1:a:0','-map','2:s:0','-t','165','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-c:s','mov_text','-metadata:s:s:0','language=eng','-disposition:s:0','0','-movflags','+faststart',clean])
run(['-i',clean,'-map','0:v:0','-map','0:a:0','-map','0:s:0','-vf','ass='+str(OUT/'captions.ass'),'-c:v','libx264','-preset','medium','-crf','17','-maxrate','12M','-bufsize','24M','-threads','4','-r','30','-fps_mode','cfr','-pix_fmt','yuv420p','-c:a','copy','-c:s','copy','-movflags','+faststart',captioned])
manifest={'sourceProductionCommit':capture['productionCommit'],'viewport':capture['viewport'],'targetSeconds':165,'voice':'Microsoft Edge TTS en-US-GuyNeural, -8%; no ElevenLabs key used','script':'Exact supplied Claude narration, 262 whitespace-separated words; reading pauses used instead of filler.','privateOperations':0,'optional4K':'Not produced: source is native 1920x1080; no upscaling claim.','export':['H.264 CRF 17','1920x1080','constant 30 fps','yuv420p','AAC 192 kbps stereo 48kHz','whole-program two-pass loudnorm -16 LUFS / -1.5 dBTP','faststart'],'files':[]}
for p in [clean,captioned]:
 probe=json.loads(subprocess.check_output([PROBE,'-v','error','-show_format','-show_streams','-of','json',str(p)]))
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'ffprobe':probe})
(OUT/'export-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('Both 1080p review exports rendered.',flush=True)
