#!/bin/sh
# 2.88: more boss-fight sounds, from the same CC0 library as fight-sfx-pack.sh (github.com/novincode/atomcut-library):
#   Male grunt/yelling sounds (haeldb), 37 hits/punches (qubodup), AtomCut impacts-risers, Kenney Sci-Fi Sounds
#   (thruster-fire, pitched far down into a torch flaring up). All CC0 1.0.
# Your hurt grunts come in three weights (a light hit, a solid one, a crushing one) instead of the old yell.
# Usage: tools/fight-sfx-pack-288.sh <atomcut-library/packs dir>
set -e
P=$1; OUT=web/sfx
G=$P/opengameart-male-gruntyelling-sounds/audio; H=$P/opengameart-37-hitspunches/audio; R=$P/impacts-risers/audio; K=$P/kenney-sci-fi-sounds/audio
B=$P/opengameart-75-cc0-breaking-falling-hit-sfx/audio
enc() { ffmpeg -loglevel error -y "$@" -ac 1 -ar 32000 -c:a libvorbis -q:a 3; }
pt() { echo "aresample=44100,asetrate=44100*$1,aresample=44100"; }
NORM="loudnorm=I=-15:TP=-1.5:LRA=11"
HALL="aecho=0.8:0.7:90|170|260:0.32|0.22|0.14"
# light hits: a short breath-grunt
i=0; for f in 3grunt1 3grunt2; do enc -i $G/$f.m4a -af "atrim=0:0.4,$(pt 1.04),highpass=f=160,$NORM,afade=t=out:st=0.28:d=0.12" -t 0.42 $OUT/g_hurt$i.ogg; i=$((i+1)); done
# solid hits: a deeper grunt with a body thump under it
i=0; for f in 3grunt6:hit03 3grunt4:hit10; do g=${f%%:*}; h=${f##*:}
  enc -i $G/$g.m4a -i $H/$h-mp3.m4a -filter_complex "[0]atrim=0:0.6,$(pt .93)[a];[1]atrim=0:0.4,volume=.7,lowpass=f=2500[b];[a][b]amix=2:normalize=0,$NORM,afade=t=out:st=0.45:d=0.15" -t 0.6 $OUT/g_hurtm$i.ogg; i=$((i+1)); done
# crushing hits: a winded, low groan, a heavy body hit and a deep impact
i=0; for f in 3grunt1:hit20 3grunt6:hit26; do g=${f%%:*}; h=${f##*:}
  enc -i $G/$g.m4a -i $H/$h-mp3.m4a -i $R/impact-deep.wav -filter_complex "[0]atrim=0:0.8,$(pt .82),aecho=0.8:0.5:60:0.2[a];[1]atrim=0:0.5,volume=.9[b];[2]volume=.55,atrim=0:0.6[c];[a][b][c]amix=3:normalize=0,$NORM,afade=t=out:st=0.7:d=0.25" -t 0.95 $OUT/g_hurth$i.ogg; i=$((i+1)); done
# a torch flaring up (the intro lights them one by one)
i=0; for f in thruster-fire-000 thruster-fire-002; do enc -i $K/$f.m4a -af "atrim=0:1.4,$(pt .5),lowpass=f=1800,$NORM,afade=t=in:d=0.05,afade=t=out:st=0.9:d=0.5" -t 1.4 $OUT/g_fire$i.ogg; i=$((i+1)); done
# the intro: a deep hit under the title (2.95 dropped the riser that used to come before it)
enc -i $R/impact-deep.wav -i $R/sub-drop.wav -i $R/tail.wav -filter_complex "[0]$(pt .8)[a];[1]$(pt .7),volume=.9[b];[2]$(pt .6),adelay=120|120,volume=.6[c];[a][b][c]amix=3:normalize=0,$HALL,$NORM,afade=t=out:st=2.2:d=0.8" -t 3 $OUT/g_title.ogg
# the hall shaking: rock trickling down from the roof
enc -i $B/bfh1-rock-falling-03.m4a -i $R/sub-drop.wav -filter_complex "[0]$(pt .6),lowpass=f=2000[a];[1]$(pt .6),volume=.7[b];[a][b]amix=2:normalize=0,$HALL,$NORM,afade=t=out:st=1.4:d=0.5" -t 1.9 $OUT/g_quake.ogg
