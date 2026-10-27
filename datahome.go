package main

// Where the planner keeps its data. Normally that's the data folder next to
// LifePlanner.exe, but two things used to lose people's planners:
//   - opening the exe straight from the zip, which Windows runs from a fresh
//     temp folder every time, so the data went with it;
//   - unzipping a new download into a new folder, which started an empty
//     planner while the real one sat in the old folder.
// So a copy run from a temp folder keeps its data in the user's own app-data
// folder, and a copy that starts with no planner brings over the one used
// last time (remembered in last-data.txt, or found in the usual places).

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var carriedFrom string // the folder a planner was brought over from at start-up

func appHome() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "LifePlanner")
}

// inTempFolder is true for an exe opened from inside a zip (or anywhere in temp).
func inTempFolder(dir string) bool {
	d := strings.ToLower(filepath.Clean(dir)) + string(filepath.Separator)
	t := strings.ToLower(filepath.Clean(os.TempDir())) + string(filepath.Separator)
	return strings.HasPrefix(d, t) || strings.Contains(d, ".zip")
}

func pickDataDir(exe string) string {
	dir := filepath.Dir(exe)
	if inTempFolder(dir) {
		if h := appHome(); h != "" {
			return filepath.Join(h, "data")
		}
	}
	return filepath.Join(dir, "data")
}

func hasPlanner(dir string) bool {
	st, err := os.Stat(filepath.Join(dir, dataFileName))
	return err == nil && st.Size() > 200
}

// carryOverData fills an empty data folder from the planner used last time.
func carryOverData() {
	if hasPlanner(dataDir) {
		rememberDataDir()
		return
	}
	src := ""
	if b, err := os.ReadFile(filepath.Join(appHome(), "last-data.txt")); err == nil {
		if p := strings.TrimSpace(string(b)); p != "" && hasPlanner(p) && !samePath(p, dataDir) {
			src = p
		}
	}
	if src == "" {
		src = findOldPlanner()
	}
	if src == "" {
		return
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || e.Name() == "planner.log" || strings.HasSuffix(e.Name(), ".tmp") {
			continue
		}
		if err := copyFile(filepath.Join(src, e.Name()), filepath.Join(dataDir, e.Name())); err != nil {
			log.Printf("carry over %s: %v", e.Name(), err)
		}
	}
	if hasPlanner(dataDir) {
		carriedFrom = src
		log.Printf("brought the planner over from %s", src)
		rememberDataDir()
	}
}

// findOldPlanner looks for the newest planner in the folders people unzip to.
func findOldPlanner() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	var found []string
	for _, base := range []string{"Downloads", "Desktop", "Documents", "OneDrive/Desktop", "OneDrive/Documents", ""} {
		for _, pat := range []string{"LifePlanner*/data", "LifePlanner*/*/data", "*/LifePlanner*/data"} {
			m, _ := filepath.Glob(filepath.Join(home, base, pat))
			found = append(found, m...)
		}
	}
	if h := appHome(); h != "" {
		found = append(found, filepath.Join(h, "data"))
	}
	var ok []string
	for _, d := range found {
		if hasPlanner(d) && !samePath(d, dataDir) && !inTempFolder(d) {
			ok = append(ok, d)
		}
	}
	sort.Slice(ok, func(i, j int) bool {
		return modTime(filepath.Join(ok[i], dataFileName)).After(modTime(filepath.Join(ok[j], dataFileName)))
	})
	if len(ok) == 0 {
		return ""
	}
	return ok[0]
}

func rememberDataDir() {
	h := appHome()
	if h == "" || os.MkdirAll(h, 0o755) != nil {
		return
	}
	os.WriteFile(filepath.Join(h, "last-data.txt"), []byte(dataDir), 0o644)
}

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func copyFile(from, to string) error {
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(to)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
