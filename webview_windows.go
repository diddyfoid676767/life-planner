//go:build windows

package main

import (
	"log"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

// WebView2 windows must be driven from the thread that created them, and
// main() is where the window runs, so pin main to its OS thread.
func init() { runtime.LockOSThread() }

const externalLinksJS = `(function(){
var own=location.origin;
function ext(u){try{var x=new URL(u,location.href);return /^https?:$/.test(x.protocol)&&x.origin!==own}catch(e){return false}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');
 if(a&&ext(a.href)){e.preventDefault();window.lpOpenExternal(a.href)}},true);
var wo=window.open;
window.open=function(u){if(u&&ext(String(u))){window.lpOpenExternal(String(u));return null}return wo.apply(this,arguments)};
})();`

// runWindow shows the planner in its own native window (the WebView2 runtime
// that ships with Windows 10/11 and Edge; no browser tabs or address bar) and
// blocks until the window is closed. It returns false straight away if
// WebView2 isn't available, so the caller can fall back to a browser window.
func runWindow(url string) (shown bool) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("webview: %v", r)
			shown = false
		}
	}()
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  filepath.Join(dataDir, "webview"),
		WindowOptions: webview2.WindowOptions{
			Title: "Life Planner", Width: 1320, Height: 880, Center: true,
		},
	})
	if w == nil {
		log.Printf("webview: WebView2 runtime not available, using a browser window")
		return false
	}
	defer w.Destroy()
	w.Bind("lpOpenExternal", func(u string) {
		if strings.HasPrefix(u, "https://") || strings.HasPrefix(u, "http://") {
			exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start()
		}
	})
	w.Init(externalLinksJS)
	hwnd := uintptr(w.Window())
	setWindowIcon(hwnd)
	setWindowAppID(hwnd, exePath())
	appHwnd = hwnd
	// exam mode asks for full screen: the window covers the whole monitor
	w.Bind("lpFullscreen", func(on bool) { w.Dispatch(func() { setFullscreen(hwnd, on) }) })
	w.Navigate(url)
	w.Run()
	return true
}

// setWindowIcon gives the window the icon embedded in LifePlanner.exe.
func setWindowIcon(hwnd uintptr) {
	h, _, _ := user32.NewProc("GetModuleHandleW").Call(0)
	name, _ := syscall.UTF16PtrFromString("APP")
	send := user32.NewProc("SendMessageW")
	load := user32.NewProc("LoadImageW")
	for i, size := range []uintptr{32, 16} { // big, small
		ic, _, _ := load.Call(h, uintptr(unsafe.Pointer(name)), 1, size, size, 0)
		if ic != 0 {
			send.Call(hwnd, 0x80, uintptr(1-i), ic) // WM_SETICON: ICON_BIG=1, ICON_SMALL=0
		}
	}
}

type winRect struct{ l, t, r, b int32 }

var (
	fsOn    bool
	fsStyle uintptr
	fsRect  winRect
)

// setFullscreen takes the window's border away and stretches it over its
// monitor, or puts it back how it was.
func setFullscreen(hwnd uintptr, on bool) {
	getLong, setLong := user32.NewProc("GetWindowLongPtrW"), user32.NewProc("SetWindowLongPtrW")
	setPos := user32.NewProc("SetWindowPos")
	const gwlStyle, overlapped, frameChanged, noZ = ^uintptr(15), 0x00CF0000, 0x0020, 0x0004
	if on == fsOn {
		return
	}
	if on {
		fsStyle, _, _ = getLong.Call(hwnd, gwlStyle)
		user32.NewProc("GetWindowRect").Call(hwnd, uintptr(unsafe.Pointer(&fsRect)))
		mon, _, _ := user32.NewProc("MonitorFromWindow").Call(hwnd, 2)
		mi := struct {
			size      uint32
			mon, work winRect
			flags     uint32
		}{size: 40}
		user32.NewProc("GetMonitorInfoW").Call(mon, uintptr(unsafe.Pointer(&mi)))
		setLong.Call(hwnd, gwlStyle, fsStyle&^overlapped)
		r := mi.mon
		setPos.Call(hwnd, 0, uintptr(r.l), uintptr(r.t), uintptr(r.r-r.l), uintptr(r.b-r.t), frameChanged)
	} else {
		setLong.Call(hwnd, gwlStyle, fsStyle)
		r := fsRect
		setPos.Call(hwnd, 0, uintptr(r.l), uintptr(r.t), uintptr(r.r-r.l), uintptr(r.b-r.t), frameChanged|noZ)
	}
	fsOn = on
}
