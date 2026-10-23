# Life Planner

A planner for school, sport and life that runs on your own Windows PC. It keeps
your SACs, homework, training, calendar and to-dos in one place, with a focus
timer, a forest that grows as you study, and an arena game that levels up with
your workouts.

Everything is saved on your computer in the `data` folder next to the app.
Nothing is uploaded anywhere.

## Download

1. Go to [Releases](../../releases/latest) and download **LifePlanner.zip**.
2. Unzip it anywhere (a USB stick works too) and run **LifePlanner.exe**.
3. Your planner opens in your browser.

Windows may warn that the app is from an unknown publisher. Click
**More info**, then **Run anyway**.

## Updates

The app checks this page for a new release every few hours. When there is
one, it downloads it and shows **Update now** at the top of the planner. Your
data stays as it is.

## Building it yourself

Install Go 1.24 or newer, then:

```
GOOS=windows GOARCH=amd64 go build -tags noseed -trimpath -ldflags "-s -w -H windowsgui" -o LifePlanner.exe .
```

## Making a release

Set `version` in `update.go` (for example `2.11`), commit, then push a
matching tag:

```
git tag v2.11
git push origin v2.11
```

GitHub Actions builds the exe and publishes the release.
