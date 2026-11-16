#!/bin/sh
# Packs the boss-fight sound set (2.87, round 2 stage R3: Golem 2.0) into web/sfx/g_*.ogg.
# Only boss fights use these; everything else keeps its own sounds.
# Sources, all CC0 1.0 (public domain), from opengameart.org via the mirror github.com/novincode/atomcut-library
# (each pack's pack.json records its licence and author):
#   80 CC0 creature SFX and 80 CC0 creature SFX 2 (rubberduck), Monster sound effects 2 (ogrebane),
#   75 CC0 breaking/falling/hit SFX (rubberduck), 20 sword sound effects (starninjas),
#   Male grunt/yelling sounds and Footsteps leather/cloth/armor (haeldb), 37 hits/punches (qubodup),
#   and AtomCut's own CC0 impacts-risers pack (impact-deep, sub-drop, whoosh-low).
# The Golem's voice and weight are made from these: pitched down (asetrate), layered, low-passed and
# given a stone-hall echo, so a short growl becomes a colossal roar.
# Usage: tools/fight-sfx-pack.sh <atomcut-library/packs dir>
set -e
P=$1; OUT=web/sfx
C=$P/opengameart-80-cc0-creature-sfx/audio; M2=$P/opengameart-monster-sound-effects-2/audio
B=$P/opengameart-75-cc0-breaking-falling-hit-sfx/audio; R=$P/impacts-risers/audio
S=$P/opengameart-20-sword-sound-effects-attacks-and-clashes/audio; G=$P/opengameart-male-gruntyelling-sounds/audio
F=$P/opengameart-footsteps-leather-cloth-armor/audio; H=$P/opengameart-37-hitspunches/audio
enc() { ffmpeg -loglevel error -y "$@" -ac 1 -ar 32000 -c:a libvorbis -q:a 3; }
# pitch by factor k (k < 1 = deeper and longer), at 44.1 kHz
pt() { echo "aresample=44100,asetrate=44100*$1,aresample=44100"; }
NORM="loudnorm=I=-15:TP=-1.5:LRA=11"
HALL="aecho=0.8:0.7:90|170|260:0.32|0.22|0.14"
# the roar (the intro and each new phase): two growls a long way down, a sub drop under them, a hall around them
enc -i $C/monster-07.m4a -i $C/monster-04.m4a -i $R/sub-drop.wav -filter_complex \
  "[0]$(pt .62),volume=1[a];[1]$(pt .55),adelay=180|180,volume=.8[b];[2]$(pt .8),volume=.7[c];[a][b][c]amix=3:normalize=0,lowpass=f=3200,$HALL,$NORM,afade=t=out:st=2.4:d=0.6" -t 3 $OUT/g_roar.ogg
enc -i $C/monster-06.m4a -i $M2/monster-3.m4a -i $R/impact-deep.wav -filter_complex \
  "[0]$(pt .6)[a];[1]$(pt .52),adelay=120|120,volume=.8[b];[2]volume=.8[c];[a][b][c]amix=3:normalize=0,lowpass=f=3000,$HALL,$NORM,afade=t=out:st=1.9:d=0.5" -t 2.4 $OUT/g_roar2.ogg
# effort growls on a big wind-up
i=0; for f in $C/grunt-02.m4a $M2/monster-4.m4a $C/troll-01.m4a; do
  enc -i $f -af "$(pt .58),lowpass=f=2600,aecho=0.8:0.5:80:0.25,$NORM" $OUT/g_growl$i.ogg; i=$((i+1)); done
# asleep (the intro): a slow stone snore
enc -i $C/snore.m4a -i $C/breath.m4a -filter_complex "[0]$(pt .45)[a];[1]$(pt .45),adelay=1100|1100,volume=.8[b];[a][b]amix=2:normalize=0,lowpass=f=1800,$NORM" $OUT/g_snore.ogg
# heavy footsteps: a dull hit far down, with a little rock rattle
i=0; for f in 02 07 06; do
  enc -i $B/bfh1-hit-$f.m4a -i $R/impact-deep.wav -filter_complex "[0]$(pt .5),lowpass=f=900[a];[1]volume=.45,atrim=0:0.5[b];[a][b]amix=2:normalize=0,$NORM,afade=t=out:st=0.45:d=0.2" -t 0.7 $OUT/g_step$i.ogg; i=$((i+1)); done
# slams and landings: a deep boom, cracking stone, a hall tail
i=0; for f in 01 02 03; do
  enc -i $R/impact-deep.wav -i $B/bfh1-rock-breaking-$f.m4a -i $R/sub-drop.wav -filter_complex \
    "[0]volume=1[a];[1]$(pt .7),volume=.9[b];[2]volume=.6[c];[a][b][c]amix=3:normalize=0,$HALL,$NORM,afade=t=out:st=1.3:d=0.5" -t 1.8 $OUT/g_boom$i.ogg; i=$((i+1)); done
# stone grinding as it winds up
i=0; for f in 01 03; do
  enc -i $B/bfh1-rock-falling-$f.m4a -af "$(pt .45),lowpass=f=2200,$NORM,afade=t=in:d=0.08" $OUT/g_grind$i.ogg; i=$((i+1)); done
# a huge arm swinging past
enc -i $R/whoosh-low.wav -af "$(pt .62),lowpass=f=2400,$NORM" $OUT/g_whoosh.ogg
# rocks crumbling off it (weak-point hits, new phases) and falling stones landing
i=0; for f in 01 02 03; do enc -i $B/bfh1-rock-breaking-$f.m4a -af "$(pt .85),$NORM" $OUT/g_crumble$i.ogg; i=$((i+1)); done
i=0; for f in 01 05; do enc -i $B/bfh1-rock-falling-$f.m4a -i $R/impact-deep.wav -filter_complex "[0]$(pt .75)[a];[1]volume=.5[b];[a][b]amix=2:normalize=0,$NORM" $OUT/g_rocks$i.ogg; i=$((i+1)); done
# your blade on stone: a clash, cut short, with a rock knock under it
i=0; for f in 2 5 10; do
  enc -i $S/sword-clash-$f.m4a -i $B/bfh1-rock-hit-01.m4a -filter_complex "[0]atrim=0:0.45,volume=.55,highpass=f=300[a];[1]$(pt .8)[b];[a][b]amix=2:normalize=0,$NORM,afade=t=out:st=0.35:d=0.12" -t 0.5 $OUT/g_clang$i.ogg; i=$((i+1)); done
# your swings
i=0; for f in 4 6 3; do enc -i $S/sword-$f.m4a -af "atrim=0:0.5,$NORM,afade=t=out:st=0.38:d=0.12" $OUT/g_swish$i.ogg; i=$((i+1)); done
# your effort and pain
i=0; for f in 3grunt3 3grunt4 3grunt5; do enc -i $G/$f.m4a -af "atrim=0:0.45,$NORM" $OUT/g_grunt$i.ogg; i=$((i+1)); done
i=0; for f in 1yell4 1yell5; do enc -i $G/$f.m4a -af "atrim=0:0.7,$NORM,afade=t=out:st=0.55:d=0.15" $OUT/g_pain$i.ogg; i=$((i+1)); done
# your armour as you roll and land
i=0; for f in step-metal-2 step-metal-3 step-lth1; do enc -i $F/$f.m4a -af "volume=6,$NORM" $OUT/g_armour$i.ogg; i=$((i+1)); done
# hard hits (weak points)
i=0; for f in hit07 hit15; do enc -i $H/$f-mp3.m4a -i $B/bfh1-rock-breaking-03.m4a -filter_complex "[0]volume=1[a];[1]volume=.6[b];[a][b]amix=2:normalize=0,$NORM" -t 0.8 $OUT/g_crack$i.ogg; i=$((i+1)); done
