//go:build windows

package main

// The planner's window is an Edge or Chrome "app" window, so Windows would
// group it with the browser and pin the browser's icon. Giving the window its
// own taskbar identity (an AppUserModelID) with a relaunch command pointing
// at LifePlanner.exe makes it a separate taskbar button, and pinning it pins
// Life Planner with its own icon.

import (
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const appUserModelID = "LifePlanner.App"

var (
	user32  = syscall.NewLazyDLL("user32.dll")
	shell32 = syscall.NewLazyDLL("shell32.dll")
	ole32   = syscall.NewLazyDLL("ole32.dll")

	procEnumWindows        = user32.NewProc("EnumWindows")
	procGetWindowTextW     = user32.NewProc("GetWindowTextW")
	procGetClassNameW      = user32.NewProc("GetClassNameW")
	procIsWindowVisible    = user32.NewProc("IsWindowVisible")
	procSHGetPropertyStore = shell32.NewProc("SHGetPropertyStoreForWindow")
	procCoInitializeEx     = ole32.NewProc("CoInitializeEx")
)

type guid struct {
	d1     uint32
	d2, d3 uint16
	d4     [8]byte
}

type propertyKey struct {
	fmtid guid
	pid   uint32
}

// PROPVARIANT holding a VT_LPWSTR
type propVariant struct {
	vt         uint16
	r1, r2, r3 uint16
	val        uintptr
	pad        uintptr
}

var (
	iidPropertyStore = guid{0x886D8EEB, 0x8CF2, 0x4446, [8]byte{0x8D, 0x02, 0xCD, 0xBA, 0x1D, 0xBD, 0xCF, 0x99}}
	fmtAppUserModel  = guid{0x9F4C2855, 0x9F79, 0x4B39, [8]byte{0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3}}
)

func pkey(pid uint32) propertyKey { return propertyKey{fmtAppUserModel, pid} }

// setWindowAppID gives one window the planner's taskbar identity.
func setWindowAppID(hwnd uintptr, exe string) bool {
	var store uintptr
	if r, _, _ := procSHGetPropertyStore.Call(hwnd, uintptr(unsafe.Pointer(&iidPropertyStore)), uintptr(unsafe.Pointer(&store))); r != 0 || store == 0 {
		return false
	}
	vtbl := *(*[8]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(store))))
	set := func(pid uint32, s string) {
		p, err := syscall.UTF16PtrFromString(s)
		if err != nil {
			return
		}
		k, v := pkey(pid), propVariant{vt: 31, val: uintptr(unsafe.Pointer(p))}
		syscall.SyscallN(vtbl[6], store, uintptr(unsafe.Pointer(&k)), uintptr(unsafe.Pointer(&v)))
		runtime.KeepAlive(p)
	}
	// relaunch details first: Windows reads them when the ID is set
	set(2, `"`+exe+`"`)              // RelaunchCommand
	set(3, exe+",0")                 // RelaunchIconResource
	set(4, "Life Planner")           // RelaunchDisplayNameResource
	set(5, appUserModelID)           // ID
	syscall.SyscallN(vtbl[7], store) // Commit
	syscall.SyscallN(vtbl[2], store) // Release
	return true
}

// planner windows: Chromium top-level windows whose title is the planner's.
// The callback is made once: Windows callbacks can't be freed.
var (
	foundWindows []uintptr
	enumCB       = syscall.NewCallback(func(hwnd, _ uintptr) uintptr {
		if v, _, _ := procIsWindowVisible.Call(hwnd); v == 0 {
			return 1
		}
		cls := make([]uint16, 64)
		procGetClassNameW.Call(hwnd, uintptr(unsafe.Pointer(&cls[0])), 64)
		if !strings.HasPrefix(syscall.UTF16ToString(cls), "Chrome_WidgetWin") {
			return 1
		}
		buf := make([]uint16, 256)
		procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), 256)
		if strings.Contains(syscall.UTF16ToString(buf), "Life Planner") {
			foundWindows = append(foundWindows, hwnd)
		}
		return 1
	})
)

func plannerWindows() []uintptr {
	foundWindows = nil
	procEnumWindows.Call(enumCB, 0)
	return foundWindows
}

// claimTaskbarIdentity watches for the planner window for a while after it
// opens and tags it (and any window opened again later in that time).
func claimTaskbarIdentity() {
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		procCoInitializeEx.Call(0, 2) // COINIT_APARTMENTTHREADED
		exe := exePath()
		done := map[uintptr]bool{}
		for i := 0; i < 240; i++ { // two minutes
			for _, h := range plannerWindows() {
				if !done[h] && setWindowAppID(h, exe) {
					done[h] = true
				}
			}
			time.Sleep(500 * time.Millisecond)
		}
	}()
}
