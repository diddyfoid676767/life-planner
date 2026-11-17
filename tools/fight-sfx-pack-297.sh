#!/bin/sh
# 2.97: Morrow, the Ever-Waiting's sounds (web/sfx/m_*.ogg), from the same CC0 library as fight-sfx-pack.sh
# (github.com/novincode/atomcut-library, mirroring opengameart.org and Kenney; each pack.json records CC0 1.0):
#   100 CC0 SFX (bells, gong, glass, metal), Kenney Impact Sounds (heavy bell) and Interface Sounds (ticks),
#   Dialog vocal samples (whispers), Random SFX (hollow wind), 50 CC0 sci-fi SFX (teleport), Magic spell SFX,
#   80 CC0 creature SFX, 20 sword sound effects, and AtomCut's own CC0 impacts-risers pack.
# A cathedral of stopped clocks: bells pitched far down into a great toll, ticks turned into a slow heavy clock,
# whispers layered into its voice, and everything given a long stone-nave echo.
# Usage: tools/fight-sfx-pack-297.sh <atomcut-library/packs dir>
set -e
P=$1; OUT=web/sfx
O=$P/opengameart-100-cc0-sfx/audio; KI=$P/kenney-impact-sounds/audio; KU=$P/kenney-interface-sounds/audio
W=$P/opengameart-dialog-vocal-samples/audio; RS=$P/opengameart-random-sfx/audio; SF=$P/opengameart-50-cc0-sci-fi-sfx/audio
MG=$P/opengameart-magic-spell-sfx/audio; C=$P/opengameart-80-cc0-creature-sfx/audio; S=$P/opengameart-20-sword-sound-effects-attacks-and-clashes/audio
R=$P/impacts-risers/audio
enc() { ffmpeg -loglevel error -y "$@" -ac 1 -ar 32000 -c:a libvorbis -q:a 3; }
pt() { echo "aresample=44100,asetrate=44100*$1,aresample=44100"; }
NORM="loudnorm=I=-15:TP=-1.5:LRA=11"
NAVE="aecho=0.8:0.8:140|300|480|700:0.42|0.3|0.2|0.12"
# the great bell: the intro and each new phase
enc -i $O/bell-03.m4a -i $KI/impact-bell-heavy-000.m4a -i $O/gong-01.m4a -i $R/sub-drop.wav -filter_complex \
  "[0]$(pt .5),volume=1[a];[1]$(pt .62),volume=.8[b];[2]$(pt .45),volume=.6[c];[3]$(pt .8),volume=.6[d];[a][b][c][d]amix=4:normalize=0,lowpass=f=4200,$NAVE,$NORM,afade=t=out:st=3.8:d=1.4" -t 5.2 $OUT/m_toll.ogg
# a smaller bell as each clock face falls (Toll of the Bells)
i=0; for f in bell-01 bell-02; do enc -i $O/$f.m4a -af "$(pt .7),lowpass=f=3800,$NAVE,$NORM,afade=t=out:st=1.6:d=0.6" -t 2.2 $OUT/m_bell$i.ogg; i=$((i+1)); done
# the clock: a slow, heavy tick and tock that never stops
enc -i $KU/tick-004.m4a -i $R/impact-deep.wav -filter_complex "[0]$(pt .42),volume=2[a];[1]atrim=0:0.15,volume=.25,lowpass=f=400[b];[a][b]amix=2:normalize=0,aecho=0.8:0.6:110|240:0.3|0.15,$NORM" -t 0.7 $OUT/m_tick0.ogg
enc -i $KU/tick-001.m4a -i $R/impact-deep.wav -filter_complex "[0]$(pt .55),volume=2[a];[1]atrim=0:0.15,volume=.2,lowpass=f=350[b];[a][b]amix=2:normalize=0,aecho=0.8:0.6:110|240:0.3|0.15,$NORM" -t 0.7 $OUT/m_tick1.ogg
# its voice: whispers far down, breathing through the hall
i=0; for f in "whisper-1:whisper-3" "whisper-2:whisper-1"; do a=${f%%:*}; b=${f##*:}
  enc -i $W/$a.m4a -i $W/$b.m4a -filter_complex "[0]$(pt .62)[a];[1]$(pt .55),adelay=160|160[b];[a][b]amix=2:normalize=0,lowpass=f=3000,$NAVE,$NORM,afade=t=out:st=1.1:d=0.4" -t 1.5 $OUT/m_whisper$i.ogg; i=$((i+1)); done
# the phase cry: a long exhale of wind and whispers under a creature's groan, a long way down
enc -i $C/monster-03.m4a -i $W/whisper-1.m4a -i $RS/hollow-wind.m4a -i $R/sub-drop.wav -filter_complex \
  "[0]$(pt .48),volume=.9[a];[1]$(pt .4),volume=1.2[b];[2]atrim=0:3,volume=.7,highpass=f=200[c];[3]$(pt .7),volume=.6[d];[a][b][c][d]amix=4:normalize=0,lowpass=f=3200,$NAVE,$NORM,afade=t=in:d=0.15,afade=t=out:st=2.4:d=0.8" -t 3.2 $OUT/m_roar.ogg
# the great clock-hand blades swinging
i=0; for f in 3 4 6; do enc -i $R/whoosh-low.wav -i $S/sword-$f.m4a -filter_complex "[0]$(pt .75)[a];[1]atrim=0:0.6,$(pt .72),volume=.8[b];[a][b]amix=2:normalize=0,lowpass=f=5000,aecho=0.8:0.5:90:0.2,$NORM" -t 1 $OUT/m_blade$i.ogg; i=$((i+1)); done
# metal dragged on stone (the blade drawn, the pendulum stuck)
enc -i $S/sword-clash-7.m4a -i $O/metal-07.m4a -filter_complex "[0]$(pt .5)[a];[1]$(pt .6),adelay=80|80,volume=.8[b];[a][b]amix=2:normalize=0,$NAVE,$NORM,afade=t=out:st=1:d=0.4" -t 1.4 $OUT/m_scrape.ogg
# Stillness: time freezing around you, like ice
enc -i $O/glass-01.m4a -i $O/glass-03.m4a -i $MG/magical-5.m4a -filter_complex "[0]$(pt .6)[a];[1]$(pt .45),adelay=120|120[b];[2]atrim=0:0.8,$(pt .7),volume=.6[c];[a][b][c]amix=3:normalize=0,$NAVE,$NORM,afade=t=out:st=1:d=0.4" -t 1.4 $OUT/m_freeze.ogg
# sand pouring (Sands of Time)
enc -i $RS/hollow-wind.m4a -af "atrim=start=2:end=4.2,asetpts=PTS-STARTPTS,$(pt .9),highpass=f=700,lowpass=f=6000,$NORM,afade=t=in:d=0.2,afade=t=out:st=1.5:d=0.6" -t 2.1 $OUT/m_sand.ogg
# vanishing into sand and stepping out of it
enc -i $SF/teleport-01.m4a -i $W/whisper-4.m4a -i $R/whoosh-high.wav -filter_complex "[0]$(pt .5),lowpass=f=3500[a];[1]$(pt .6),volume=.9[b];[2]areverse,$(pt .8),volume=.6[c];[a][b][c]amix=3:normalize=0,aecho=0.8:0.5:90|200:0.25|0.12,$NORM" -t 1 $OUT/m_blink.ogg
# a falling clock face smashing on the floor
i=0; for f in metal-03:glass-03 metal-07:glass-01; do m=${f%%:*}; g=${f##*:}
  enc -i $O/$m.m4a -i $O/$g.m4a -i $R/impact-deep.wav -i $O/bell-02.m4a -filter_complex "[0]$(pt .7)[a];[1]$(pt .8),volume=.8[b];[2]volume=.8[c];[3]$(pt .6),volume=.5[d];[a][b][c][d]amix=4:normalize=0,aecho=0.8:0.55:100|220:0.3|0.15,$NORM,afade=t=out:st=1.2:d=0.4" -t 1.6 $OUT/m_crash$i.ogg; i=$((i+1)); done
