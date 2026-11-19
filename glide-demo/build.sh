#!/bin/sh
# Glide demo: YouTube (16:9, ~2:12) and Instagram Reel (9:16, ~1:02) from one engine.  sh glide-demo/build.sh [yt|reel]
# Needs the Lemo-Opuscar library (LEMO) with its .venv, node and ffmpeg. Music: vol. 11 from the brag plugin (CC BY 4.0, see CREDITS).
set -e
LEMO=${LEMO:-/c/Users/Srivarsan/lemo-opuscar}; PY=$LEMO/.venv/Scripts/python.exe
P=$(cd "$(dirname "$0")" && pwd); mkdir -p "$P/out"; PW=$(cygpath -m "$P" 2>/dev/null || echo "$P")   # Windows Python needs C:/ paths
if [ ! -f "$P/audio/vol11_long.wav" ]; then   # the track is 87.6 s; two passes crossfaded cover the long cut
  M=$(ls ~/.claude/plugins/cache/brag/brag/*/skills/brag/assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3 | head -1)
  ffmpeg -v error -y -i "$M" -i "$M" -filter_complex "[0][1]acrossfade=d=3:c1=tri:c2=tri" -t 140 -ar 48000 -ac 2 "$P/audio/vol11_long.wav"
fi
cd "$LEMO"
for C in ${1:-yt reel}; do
  if [ "$C" = yt ]; then S=1920x1080; NAME=glide-demo-youtube; PT=11; else S=1080x1920; NAME=glide-demo-reel; PT=10.5; fi
  node core/render/events.mjs "$P" --q "cut=$C" --size $S --out "$P/out/events_$C.json"
  node core/render/readcheck.mjs "$P" --q "cut=$C" --size $S
  "$PY" "$P/sound.py" "$PW/out/events_$C.json" "$PW/out/mix_$C.wav"
  node core/render/video.mjs "$P" --q "cut=$C" --size $S --fps 30 --workers 6 --out "$P/out/video_$C.mp4"
  sh core/render/mux.sh "$P/out/video_$C.mp4" "$P/out/mix_$C.wav" "$P/$NAME.mp4" 30 0
  "$PY" -c "import json;e=json.load(open(r'$PW/out/events_$C.json',encoding='utf-8'))['ev'];json.dump([dict(t0=x['t'],t1=x['t1'],text=x['text']) for x in e if x['type']=='sub'],open(r'$PW/out/subs_$C.json','w',encoding='utf-8'))"
  "$PY" core/render/srt.py "$PW/out/subs_$C.json" "$PW/$NAME.srt"
  node core/render/still.mjs "$P" $PT --q "cut=$C" --size $S --prefix "po_${C}_" --out "$P/out" && cp "$P/out/po_${C}_$PT.jpg" "$P/$NAME-poster.jpg"
  echo "built $P/$NAME.mp4"
done
