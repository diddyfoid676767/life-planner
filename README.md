# Life Planner

A planner for school, sport and life that runs on your own Windows PC. It keeps
your SACs, homework, training, calendar and to-dos in one place, with a focus
timer, a forest that grows as you study, and an arena game that levels up with
your workouts.

Everything is saved on your computer in the `data` folder next to the app.
Nothing leaves your PC unless you turn it on: signing in to share with
friends and battle them, or adding your own Claude API key (then the in-planner
chat and email sorting send the page or your new emails to Claude).

## Ask Claude and the email check

The ✦ **Ask Claude** button (or Ctrl+J) opens your Claude app with your
question and the page you're on copied, ready to paste. Adding your own Claude
API key in **Settings, App** is optional: with one, the chat runs right inside
the planner.

To have the planner read Gmail itself, add your Gmail address and a Google
[app password](https://myaccount.google.com/apppasswords) in **Settings, App**.
While the planner is open it checks every 30 minutes from 7am to 10pm, skips
newsletters and ads, and puts the rest into **Missed info** with any due dates
it finds. This is free; with an API key, Claude sorts and summarises instead.

## Phone app

The same planner runs on your phone at
<https://diddyfoid676767.github.io/life-planner/>. Log in with your Life
Planner account (make one in the PC app under **Settings, Account**), then add
it to your home screen: in Safari tap **Share, Add to Home Screen**, or in
Chrome tap **⋮, Add to Home screen**.

While the PC app is logged in to the same account, it keeps your planner in
your own row on the friends server, so the phone and PC show the same thing.
The email check, Strava and calendar syncing still run on the PC. The server
needs `supabase-2.29-phone-sync.sql` run once in the Supabase SQL Editor.

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

Set `version` in `update.go` (for example `2.12`) and push to `main`. GitHub
Actions builds the exe and publishes a release for that version if there
isn't one yet.
