//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// The "are you still here?" question as a native Windows box that sits on top of every
// other window, with a loud chime, so it's seen even when Solis is in the background.

const stillTitle = "Solis: still studying?"

var (
	winmm         = syscall.NewLazyDLL("winmm.dll")
	stillChimeWav = makeChime()
)

func showStillAlert(text string) string {
	winmm.NewProc("PlaySoundW").Call(uintptr(unsafe.Pointer(&stillChimeWav[0])), 0, 0x0004|0x0001) // SND_MEMORY|SND_ASYNC
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString(stillTitle)
	// MB_YESNO | MB_ICONQUESTION | MB_SYSTEMMODAL | MB_SETFOREGROUND | MB_TOPMOST
	r, _, _ := user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x4|0x20|0x1000|0x10000|0x40000)
	if r == 6 {
		return "yes"
	}
	return "no"
}

// closeStillAlert answers the box with Yes for the app (the caller ignores that answer).
func closeStillAlert() {
	c, _ := syscall.UTF16PtrFromString(stillTitle)
	cls, _ := syscall.UTF16PtrFromString("#32770")
	if h, _, _ := user32.NewProc("FindWindowW").Call(uintptr(unsafe.Pointer(cls)), uintptr(unsafe.Pointer(c))); h != 0 {
		user32.NewProc("PostMessageW").Call(h, 0x0111, 6, 0) // WM_COMMAND IDYES
	}
}
