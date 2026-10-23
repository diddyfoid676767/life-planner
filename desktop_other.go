//go:build !windows

package main

import "errors"

func openAppWindow(url string) bool { return false }

func shortcutStatus() map[string]bool { return map[string]bool{} }

func setShortcut(where string, on bool) error {
	return errors.New("shortcuts are only available on Windows")
}

func findBrainfm(custom string) string { return "" }

func launchApp(target string) error { return errors.New("only available on Windows") }

func openClaude(path string) bool { return false }
