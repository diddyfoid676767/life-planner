//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// openAppWindow opens the planner in its own window (Edge or Chrome "app"
// mode: no tabs or address bar) so it feels like a normal desktop app.
func openAppWindow(url string) bool {
	var cands []string
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LocalAppData"} {
		base := os.Getenv(env)
		if base == "" {
			continue
		}
		cands = append(cands,
			filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
	}
	for _, c := range cands {
		if _, err := os.Stat(c); err != nil {
			continue
		}
		if exec.Command(c, "--app="+url, "--window-size=1320,880").Start() == nil {
			claimTaskbarIdentity()
			return true
		}
	}
	return false
}

func hiddenCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd
}

func shortcutDirs() map[string]string {
	app := os.Getenv("APPDATA")
	home, _ := os.UserHomeDir()
	desk := filepath.Join(home, "Desktop")
	if od := os.Getenv("OneDrive"); od != "" {
		if _, err := os.Stat(filepath.Join(od, "Desktop")); err == nil {
			desk = filepath.Join(od, "Desktop")
		}
	}
	return map[string]string{
		"desktop":   desk,
		"startmenu": filepath.Join(app, "Microsoft", "Windows", "Start Menu", "Programs"),
		"startup":   filepath.Join(app, "Microsoft", "Windows", "Start Menu", "Programs", "Startup"),
	}
}

func shortcutStatus() map[string]bool {
	out := map[string]bool{}
	for k, d := range shortcutDirs() {
		_, err := os.Stat(filepath.Join(d, "Life Planner.lnk"))
		out[k] = err == nil
	}
	return out
}

func setShortcut(where string, on bool) error {
	dir, ok := shortcutDirs()[where]
	if !ok {
		return os.ErrInvalid
	}
	lnk := filepath.Join(dir, "Life Planner.lnk")
	if !on {
		err := os.Remove(lnk)
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	exe := exePath()
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	ps := "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" + q(lnk) + ");" +
		"$s.TargetPath=" + q(exe) + ";$s.WorkingDirectory=" + q(filepath.Dir(exe)) + ";" +
		"$s.IconLocation=" + q(exe+",0") + ";$s.Description='Life Planner';$s.Save()"
	return hiddenCmd("powershell", "-NoProfile", "-NonInteractive", "-Command", ps).Run()
}

// ---- Brain.fm desktop app ----

var brainfmAppID string // cached Start-menu AppID (Store installs)

func containsBrain(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "brain") && !strings.Contains(n, "uninstall")
}

// findBrainfm returns the Brain.fm app to launch: an .exe, a .lnk, or
// "shell:AppsFolder\<AppID>" for a Microsoft Store install. "" if not found.
func findBrainfm(custom string) string {
	if custom != "" {
		if st, err := os.Stat(custom); err == nil && !st.IsDir() {
			return custom
		}
	}
	if la := os.Getenv("LOCALAPPDATA"); la != "" {
		// Squirrel install: %LOCALAPPDATA%\brain\Brain.fm.exe starts the newest app-x.y.z folder
		if _, err := os.Stat(filepath.Join(la, "brain", "Brain.fm.exe")); err == nil {
			return filepath.Join(la, "brain", "Brain.fm.exe")
		}
		dirs, _ := filepath.Glob(filepath.Join(la, "*"))
		more, _ := filepath.Glob(filepath.Join(la, "Programs", "*"))
		dirs = append(dirs, more...)
		for _, d := range dirs {
			if !containsBrain(filepath.Base(d)) {
				continue
			}
			exes, _ := filepath.Glob(filepath.Join(d, "*.exe"))
			for _, e := range exes {
				if containsBrain(filepath.Base(e)) {
					return e
				}
			}
		}
	}
	home, _ := os.UserHomeDir()
	roots := []string{
		filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs"),
		filepath.Join(os.Getenv("ProgramData"), "Microsoft", "Windows", "Start Menu", "Programs"),
		filepath.Join(home, "Desktop"),
		filepath.Join(home, "OneDrive", "Desktop"),
	}
	for _, root := range roots {
		found := ""
		filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
			if err != nil || found != "" {
				return filepath.SkipDir
			}
			if d.IsDir() && strings.Count(strings.TrimPrefix(p, root), string(os.PathSeparator)) > 2 {
				return filepath.SkipDir
			}
			if !d.IsDir() && strings.EqualFold(filepath.Ext(p), ".lnk") && containsBrain(d.Name()) {
				found = p
			}
			return nil
		})
		if found != "" {
			return found
		}
	}
	if brainfmAppID == "" {
		out, err := hiddenCmd("powershell", "-NoProfile", "-NonInteractive", "-Command",
			"Get-StartApps | Where-Object { $_.Name -like '*brain*' } | Select-Object -First 1 -ExpandProperty AppID").Output()
		if err == nil {
			brainfmAppID = strings.TrimSpace(string(out))
		}
	}
	if brainfmAppID != "" {
		return `shell:AppsFolder\` + brainfmAppID
	}
	return ""
}

func launchApp(target string) error {
	if strings.HasPrefix(target, "shell:") {
		return exec.Command("explorer.exe", target).Start()
	}
	if strings.EqualFold(filepath.Ext(target), ".exe") {
		cmd := exec.Command(target)
		cmd.Dir = filepath.Dir(target)
		return cmd.Start()
	}
	return hiddenCmd("cmd", "/c", "start", "", target).Start()
}

// openClaude opens a claude.ai path in the Claude desktop app. It uses the
// claude:// link when the app has registered it, otherwise starts the app
// itself. Returns false when the app isn't installed.
func openClaude(path string) bool {
	if hiddenCmd("reg", "query", `HKCU\Software\Classes\claude`).Run() == nil ||
		hiddenCmd("reg", "query", `HKCR\claude`).Run() == nil {
		return hiddenCmd("cmd", "/c", "start", "", "claude://claude.ai"+path).Start() == nil
	}
	la := os.Getenv("LOCALAPPDATA")
	for _, p := range []string{filepath.Join(la, "AnthropicClaude", "claude.exe"), filepath.Join(la, "Programs", "Claude", "Claude.exe")} {
		if _, err := os.Stat(p); err == nil {
			cmd := exec.Command(p)
			cmd.Dir = filepath.Dir(p)
			return cmd.Start() == nil
		}
	}
	return false
}
