"""Synthesize the exact public script and matching word timing. Never reads app secrets."""
import asyncio,json,pathlib,hashlib,re
import edge_tts
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'render';OUT.mkdir(exist_ok=True)
VOICE='en-US-GuyNeural'
async def main():
 for scene in json.loads((ROOT/'scripts/scenes.json').read_text()):
  name=scene['id'];mp3=OUT/(name+'.mp3');timing=OUT/(name+'-words.json')
  if mp3.exists() and timing.exists():continue
  for attempt in range(3):
   try:
    audio=bytearray();words=[]
    async for event in edge_tts.Communicate(scene['text'],VOICE,rate='-8%',boundary='WordBoundary').stream():
     if event['type']=='audio':audio.extend(event['data'])
     elif event['type']=='WordBoundary':words.append(event)
    normalize=lambda t:re.sub(r'[^a-z0-9]', '', t.lower())
    if not audio or normalize(''.join(w['text'] for w in words))!=normalize(scene['text']):raise RuntimeError('Missing or mismatched narration timing for '+name)
    mp3.write_bytes(audio);timing.write_text(json.dumps({'voice':VOICE,'rate':'-8%','sha256':hashlib.sha256(audio).hexdigest(),'words':words},indent=2)+'\n')
    print(name,'voice and',len(words),'word timings saved',flush=True)
    await asyncio.sleep(12);break
   except Exception:
    if attempt==2:raise
    await asyncio.sleep(15)
asyncio.run(main())
