# SpotI

A tiny always-on-top desktop companion — styled as an LP half-slid out of its
case — that sits on your desktop and controls Spotify playback. Drag it
anywhere; hover it to see what's playing and control playback.

## Features

- Draggable desktop pet, click-through everywhere except its own artwork
- Hover popup: album art, track/artist, play/pause/next/prev, seekable
  progress bar, volume
- Spotify login via PKCE (your own Client ID — no shared secret)
- Settings window
  - **General** — language, volume, launch at startup, pet size, track-change
    notifications, sync speed, reset to defaults
  - **Theme** — light/dark mode, font color, LP color, case color, border
    toggle
  - **Spotify** — connection status, version info
- Listening-history heatmap (daily totals, streaks, best track per day)
- Korean, English, Chinese, and Japanese UI

## Setup

1. `npm install`
2. Create your own Spotify app at https://developer.spotify.com/dashboard,
   click **Create app**, and set the **Redirect URI** to exactly:
   ```
   http://127.0.0.1:8765/callback
   ```
3. Copy `spotify.config.json.example` to `spotify.config.json` and paste in
   your app's **Client ID**:
   ```json
   { "clientId": "your-client-id-here" }
   ```
4. `npm run dev`

## Notes

- Playback control (play/pause/next/previous, seeking, volume) requires
  **Spotify Premium** and an already-active Spotify Connect device (desktop
  app, phone, or web player open somewhere).
- `npm run dist` builds a Windows installer via electron-builder.

## Stack

Electron + TypeScript, built with `electron-vite`. No UI framework — vanilla
DOM.
