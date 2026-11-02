//go:build windows

package main

// The planner's window is an Edge or Chrome "app" window, so Windows would
// group it with the browser and pin the browser's icon. Giving the window its
// own taskbar identity (an AppUserModelID) with a relaunch command pointing
// at LifePlanner.exe makes it a separate taskbar button, and pinning it pins
// Life Planner with its own icon.

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
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

// ---------- unread dot on the taskbar button ----------
// ITaskbarList3::SetOverlayIcon puts a small icon over the planner's taskbar
// button. The dot is a PNG drawn here and turned into an icon by Windows.
var (
	procCoCreateInstance         = ole32.NewProc("CoCreateInstance")
	procCreateIconFromResourceEx = user32.NewProc("CreateIconFromResourceEx")
	procDestroyIcon              = user32.NewProc("DestroyIcon")
	clsidTaskbarList             = guid{0x56FDF344, 0xFD6D, 0x11d0, [8]byte{0x95, 0x8A, 0x00, 0x60, 0x97, 0xC9, 0xA0, 0x90}}
	iidTaskbarList3              = guid{0xEA1AFB91, 0x9E28, 0x4B86, [8]byte{0x90, 0xE9, 0x9E, 0x9F, 0x8A, 0x5E, 0xEF, 0xAF}}
	badgeCh                      = make(chan int, 8)
	appHwnd                      uintptr // the WebView2 window, when the planner has one
)

func init() { go badgeLoop() }

func setTaskbarBadge(n int) {
	select {
	case badgeCh <- n:
	default:
	}
}

// one COM thread owns the taskbar object; it reapplies the dot now and then
// because a reopened window gets a fresh taskbar button.
func badgeLoop() {
	runtime.LockOSThread()
	procCoInitializeEx.Call(0, 2)
	var tb uintptr
	if r, _, _ := procCoCreateInstance.Call(uintptr(unsafe.Pointer(&clsidTaskbarList)), 0, 1, uintptr(unsafe.Pointer(&iidTaskbarList3)), uintptr(unsafe.Pointer(&tb))); r != 0 || tb == 0 {
		for range badgeCh {
		}
		return
	}
	vt := *(*[19]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(tb))))
	syscall.SyscallN(vt[3], tb) // HrInit
	dot := badgeIcon()
	n := 0
	apply := func() {
		var ic uintptr
		if n > 0 {
			ic = dot
		}
		desc, _ := syscall.UTF16PtrFromString("Unread messages")
		wins := plannerWindows()
		if appHwnd != 0 {
			wins = append(wins, appHwnd)
		}
		for _, h := range wins {
			syscall.SyscallN(vt[18], tb, h, ic, uintptr(unsafe.Pointer(desc))) // SetOverlayIcon
		}
	}
	tick := time.NewTicker(20 * time.Second)
	for {
		select {
		case n = <-badgeCh:
		case <-tick.C:
			if n == 0 {
				continue
			}
		}
		apply()
	}
}

func badgeIcon() uintptr {
	const s = 32
	img := image.NewNRGBA(image.Rect(0, 0, s, s))
	for y := 0; y < s; y++ {
		for x := 0; x < s; x++ {
			dx, dy := float64(x)-15.5, float64(y)-15.5
			d := math.Sqrt(dx*dx + dy*dy)
			switch {
			case d <= 13:
				img.Set(x, y, color.NRGBA{0xE0, 0x31, 0x31, 0xFF})
			case d <= 15.5:
				img.Set(x, y, color.NRGBA{0xFF, 0xFF, 0xFF, 0xFF})
			}
		}
	}
	var buf bytes.Buffer
	png.Encode(&buf, img)
	b := buf.Bytes()
	h, _, _ := procCreateIconFromResourceEx.Call(uintptr(unsafe.Pointer(&b[0])), uintptr(len(b)), 1, 0x00030000, s, s, 0)
	runtime.KeepAlive(b)
	return h
}
