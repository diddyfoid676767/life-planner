package main

// The app used to be LifePlanner.exe and is now Solis.exe. An install that
// updates itself keeps its old file name, so on start LifePlanner.exe copies
// itself to Solis.exe (once), points the Windows shortcuts at it and hands
// over. LifePlanner.exe stays as a tiny forwarder so any shortcut or pin that
// still names it keeps working. If anything fails it just carries on as it is.

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func handOverToSolis(self string) bool {
	if runtime.GOOS != "windows" || !strings.EqualFold(filepath.Base(self), "LifePlanner.exe") {
		return false
	}
	dir := filepath.Dir(self)
	target := filepath.Join(dir, "Solis.exe")
	if _, err := os.Stat(target); err != nil {
		b, err := os.ReadFile(self)
		if err != nil {
			return false
		}
		tmp := target + ".tmp"
		if err := os.WriteFile(tmp, b, 0o755); err != nil {
			os.Remove(tmp)
			return false
		}
		if err := os.Rename(tmp, target); err != nil {
			os.Remove(tmp)
			return false
		}
		for where, on := range shortcutStatus() { // move shortcuts to the new name and exe
			if on {
				setShortcut(where, true)
			}
		}
	}
	cmd := exec.Command(target, os.Args[1:]...)
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		log.Printf("could not open Solis.exe: %v", err)
		return false
	}
	return true
}
