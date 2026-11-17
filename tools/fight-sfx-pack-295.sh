#!/bin/sh
# 2.95: the intro's own sounds, from the same CC0 library as fight-sfx-pack.sh (github.com/novincode/atomcut-library):
#   80 CC0 creature SFX (rubberduck), AtomCut impacts-risers, 75 CC0 breaking/falling/hit SFX (rubberduck). All CC0 1.0.
# A huge, long waking roar (several roars and growls far down, doubled a touch apart so it sounds enormous, over a sub drop
# and a rumble of falling stone), the deep breath it draws in first, and a low growl as its eyes open.
# Usage: tools/fight-sfx-pack-295.sh <atomcut-library/packs dir>
set -e
P=$1; OUT=web/sfx
C=$P/opengameart-80-cc0-creature-sfx/audio; R=$P/impacts-risers/audio; B=$P/opengameart-75-cc0-breaking-falling-hit-sfx/audio
enc() { ffmpeg -loglevel error -y "$@" -ac 1 -ar 32000 -c:a libvorbis -q:a 3; }
pt() { echo "aresample=44100,asetrate=44100*$1,aresample=44100"; }
NORM="loudnorm=I=-14:TP=-1.2:LRA=11"
HALL="aecho=0.8:0.75:110|210|330|470:0.38|0.26|0.18|0.1"
enc -i $C/troll-01.m4a -i $C/roar-02.m4a -i $C/roar-02.m4a -i $C/monster-07.m4a -i $C/monster-04.m4a -i $R/sub-drop.wav -i $B/bfh1-rock-falling-03.m4a -filter_complex \
  "[0]$(pt .5),volume=.9[a];[1]$(pt .52),adelay=180|180[b];[2]$(pt .47),adelay=200|200,volume=.8[c];[3]$(pt .5),adelay=650|650,volume=.9[d];[4]$(pt .46),adelay=1300|1300,volume=.85[e];[5]$(pt .6),volume=.8[f];[6]$(pt .55),adelay=900|900,volume=.6,lowpass=f=1500[g];[a][b][c][d][e][f][g]amix=7:normalize=0,lowpass=f=3400,$HALL,$NORM,afade=t=in:d=0.05,afade=t=out:st=3.6:d=1" -t 4.6 $OUT/g_roarbig.ogg
enc -i $C/breath.m4a -af "atrim=0:0.6,$(pt .42),lowpass=f=1600,aecho=0.8:0.6:120|240:0.3|0.18,$NORM,afade=t=in:d=0.3,afade=t=out:st=1.2:d=0.35" -t 1.6 $OUT/g_breath.ogg
enc -i $C/troll-02.m4a -i $C/monster-07.m4a -filter_complex "[0]$(pt .48)[a];[1]$(pt .42),adelay=250|250,volume=.6[b];[a][b]amix=2:normalize=0,lowpass=f=2200,$HALL,$NORM,afade=t=out:st=2:d=0.6" -t 2.6 $OUT/g_wake.ogg
