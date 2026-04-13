# PokerFace ♠

A lightweight, real-time planning poker app for agile estimation. No frameworks, no build tools — just vanilla JS + Firebase.

[Live Demo](https://pawangujral.github.io/pokerface/)

## Features

### Core
- **Create/Join sessions** — shareable link or session code
- **Fibonacci estimation** — 0, 1, 2, 3, 5, 8, 13, 21, ?, ☕
- **Real-time sync** — votes, participants, and timer update instantly for everyone
- **Hidden votes** — no anchoring bias until "Show Votes" is clicked
- **Auto-cleanup** — sessions expire after 24 hours

### Role-Based Estimation
- **Role selection** — join as Developer, QA, DevOps/SRE, Designer, or Business
- **Grouped participants** — each role gets its own card in the sidebar
- **Per-role stats** — after reveal, see each group's average and consensus separately
- **Total estimate** — overall score is the sum of each role's average (e.g. Dev avg 5 + QA avg 3 = 8 points)

### Timer
- **Countdown timer** — 30s, 1:00, 1:30, or 2:00 options
- **Synced across participants** — everyone sees the same countdown
- **Visual progress bar** — turns yellow at 50%, pulses red at 20%

### Spectator Mode
- **Watch-only participants** — join without affecting vote stats
- **Separate panel** — spectators shown in their own section with 👁 badge

### Emoji Reactions
- **Post-reveal reactions** — 👍 🤔 😱 🎯 💀
- **Floating pill UI** — appears in the bottom-right corner, out of the way
- **Animated emojis** — float up from the bottom of the screen

### Keyboard Shortcuts
- **0–9 keys** — vote quickly by pressing the card index
- **R** — reveal votes
- **N** — start a new round

### Confetti
- **Full agreement celebration** — when every role group agrees, confetti rains down

## Tech Stack

- **Frontend:** Vanilla ES6+ JavaScript (no frameworks, no build step)
- **Backend:** Firebase Realtime Database
- **Analytics:** Firebase Analytics
- **Hosting:** GitHub Pages
- **Styling:** Plain CSS with dark theme

## Getting Started

1. Open the [live demo](https://pawangujral.github.io/pokerface/)
2. Click **Create Session**
3. Enter your name and select your role
4. Share the link or session code with your team
5. Estimate!

## Local Development

```bash
# Clone the repo
git clone https://github.com/pawangujral/PokerFace.git
cd PokerFace

# Serve locally (any static server works)
npx serve .
```

You'll need to configure Firebase credentials in `js/firebase-config.js` for the database to work.

## Help

See the [Help page](https://pawangujral.github.io/pokerface/help.html) for a full guide on every feature.

## Author

Built by [Pawan Gujral](https://pawangujral.dev/)
