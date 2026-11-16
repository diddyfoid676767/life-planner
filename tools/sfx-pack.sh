#!/bin/sh
# Packs the recorded sound effects (2.80, feedback stage F3) into web/sfx/*.ogg: short, mono, small.
# Sources, all CC0 by Kenney (www.kenney.nl): RPG Audio, Impact Sounds and Interface Sounds
# (mirrors: github.com/Boyquotes/kenney-rpg-audio-for-godot, github.com/Boyquotes/kenney-impact-sounds-for-godot,
#  github.com/Calinou/kenney-interface-sounds).
# Usage: tools/sfx-pack.sh <rpg dir> <impact dir> <interface dir>
set -e
RPG=$1; IMP=$2; UI=$3; OUT=web/sfx
mkdir -p $OUT
p() { ffmpeg -loglevel error -y -i "$1" -ac 1 -ar 32000 -c:a libvorbis -q:a 2 "$OUT/$2.ogg"; }
# buttons and menus
for i in 1 2 3; do p "$UI/click_00$i.wav" click$i; done
p "$UI/tick_002.wav" hover; p "$UI/tick_001.wav" tick
p "$UI/select_001.wav" tab1; p "$UI/select_002.wav" tab2; p "$UI/select_006.wav" select
p "$UI/open_001.wav" open; p "$UI/close_001.wav" close; p "$UI/maximize_003.wav" sheet; p "$UI/minimize_003.wav" sheetclose
p "$UI/toggle_001.wav" toggle; p "$UI/toggle_002.wav" untoggle; p "$UI/switch_002.wav" nav
p "$UI/pluck_002.wav" check; p "$UI/back_001.wav" uncheck; p "$UI/drop_002.wav" add; p "$UI/scratch_002.wav" trash
p "$UI/error_004.wav" error; p "$UI/error_006.wav" deny; p "$UI/bong_001.wav" notify; p "$UI/confirmation_001.wav" save
p "$UI/confirmation_002.wav" success; p "$UI/confirmation_004.wav" levelup; p "$UI/maximize_006.wav" start; p "$UI/back_003.wav" undo; p "$UI/drop_004.wav" pop
p "$RPG/handle_coins.ogg" coin; p "$RPG/handle_coins_2.ogg" buy; p "$RPG/door_open_1.ogg" door; p "$RPG/book_open.ogg" book
# walking
for i in 0 1 2 3 4; do p "$IMP/footstep_grass_00$i.ogg" grass$i; p "$IMP/footstep_concrete_00$i.ogg" stone$i; p "$IMP/footstep_wood_00$i.ogg" wood$i; done
p "$RPG/cloth_2.ogg" jump; p "$IMP/impact_soft_medium_000.ogg" land; p "$RPG/cloth_4.ogg" roll
# fights
for i in 1 2 3; do p "$RPG/draw_knife_$i.ogg" swing$i; done
for i in 0 1 2; do p "$IMP/impact_punch_medium_00$i.ogg" hit$i; p "$IMP/impact_punch_heavy_00$i.ogg" heavy$i; p "$IMP/impact_metal_light_00$i.ogg" clank$i; done
p "$IMP/impact_mining_000.ogg" slam; p "$IMP/impact_soft_heavy_001.ogg" hurt; p "$RPG/metal_latch.ogg" cast
