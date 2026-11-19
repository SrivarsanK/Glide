#!/bin/sh
# Watch the Code — rebuild everything: sh glide-watch-the-code/build.sh
# Needs the Lemo-Opuscar library (LEMO) with its .venv, node and ffmpeg. Music: vol. 11 from the brag plugin (CC BY 4.0, see CREDITS).
set -e
LEMO=${LEMO:-/c/Users/Srivarsan/lemo-opuscar}; PY=$LEMO/.venv/Scripts/python.exe
P=$(cd "$(dirname "$0")" && pwd); mkdir -p "$P/out"; PW=$(cygpath -m "$P" 2>/dev/null || echo "$P")   # Windows Python needs C:/ paths
[ "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$P/audio/vol11.wav" 2>/dev/null | cut -d. -f1)" -ge 44 ] 2>/dev/null || ffmpeg -v error -y -i "$(ls ~/.claude/plugins/cache/brag/brag/*/skills/brag/assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3 | head -1)" -t 45 -ar 48000 -ac 2 "$P/audio/vol11.wav"
cd "$LEMO"
node core/render/events.mjs "$P" --size 1080x1080                 # every key, click, jump, stomp → events.json
node core/render/readcheck.mjs "$P" --size 1080x1080              # caption reading time
"$PY" "$P/sound.py"                                               # vol. 11 bed + chiptune + foley → mix.wav
node core/render/video.mjs "$P" --size 1080x1080 --fps 30 --workers 6 --out "$P/out/video30.mp4"
sh core/render/mux.sh "$P/out/video30.mp4" "$P/mix.wav" "$P/watch-the-code.mp4" 30 0   # −14 LUFS, no grain (pixel style)
# subtitles straight from film.js SUBS (the loop's repeat caption past DUR is dropped)
"$PY" -c "import re,json;s=open(r'$PW/film.js',encoding='utf-8').read();c=[dict(t0=float(a),t1=float(b),text=x) for a,b,x in re.findall(r\"\[(\d+\.\d+), (\d+\.\d+), '([^']+)'\]\",s.split('export const SUBS')[1].split('];')[0]) if float(b)<=25];json.dump(c,open(r'$PW/out/subs.json','w'))"
"$PY" core/render/srt.py "$PW/out/subs.json" "$PW/subtitles_en.srt"
node core/render/still.mjs "$P" 0 --size 1080x1080 --prefix po_ --out "$P/out" && cp "$P/out/po_0.jpg" "$P/poster.jpg"
echo "built $P/watch-the-code.mp4"
