# Hawkario

Professional countdown timer with customizable display for broadcasts and presentations.

## Features

- **Countdown & Count-up modes** - Flexible timer for any use case
- **Dual-window design** - Control panel + fullscreen output window
- **Real-time preview** - See changes instantly
- **Customizable typography** - Font, size, weight, color, stroke, shadow
- **Warning system** - Color change, flash effects, and sound alerts at custom thresholds
- **Sound alerts** - Audio notifications for warnings and timer end
- **Preset management** - Save, load, duplicate, import/export presets
- **Keyboard shortcuts** - Quick controls from any window
- **Multi-display support** - Output window opens on secondary display when available

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
# Install dependencies
npm install

# Run the app
npm start
```

### Building

```bash
# Build DMG for macOS
npm run build:dmg
```

## Usage

1. Launch Hawkario with `npm start`
2. Configure your timer settings in the control window
3. Click **Open Output Window** to open the display
4. Press **F** in the output window for fullscreen
5. Use **Start**, **Pause**, **Reset** to control the timer

## Keyboard Shortcuts

### Control Window
| Shortcut | Action |
|----------|--------|
| Cmd+Return | Start timer |
| Cmd+. | Pause timer |
| Cmd+R | Reset timer |
| Cmd+F | Toggle output fullscreen |
| Cmd+N | New output window |

### Output Window
| Shortcut | Action |
|----------|--------|
| Space | Play/Pause toggle |
| R | Reset timer |
| F | Toggle fullscreen |
| Escape | Exit fullscreen |

## Project Structure

```
Hawkario/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── src/
│   ├── control/         # Control window
│   │   ├── index.html
│   │   ├── control.js
│   │   └── control.css
│   ├── viewer/          # Output window
│   │   ├── viewer.html
│   │   ├── viewer.js
│   │   └── viewer.css
│   ├── shared/          # Shared utilities
│   │   ├── base.css
│   │   ├── constants.js
│   │   ├── timer.js
│   │   ├── validation.js
│   │   └── sounds.js
│   └── assets/
│       └── sounds/      # Sound files (future)
├── icon.icns
├── package.json
└── README.md
```

## Configuration Options

### Timer
- **Mode**: Countdown or Count-up
- **Duration**: Set time in HH:MM:SS format
- **Format**: Display as H:MM:SS, MM:SS, or SS

### Typography
- **Font**: Any system font
- **Weight**: 400-800
- **Size**: 1-50vw
- **Color & Opacity**: Full color picker
- **Stroke**: Outline width and color
- **Shadow**: CSS text-shadow
- **Alignment**: Left, Center, Right
- **Letter spacing**: Adjust character spacing

### Background
- **Mode**: Transparent or Solid
- **Color & Opacity**: For solid backgrounds

### Warnings
- **Enable/Disable**: Toggle warning system
- **Threshold**: Time at which warning activates
- **Color change**: Turn text red (customizable)
- **Flash effect**: Pulsing visibility with adjustable rate

### Sound Alerts
- **Warning sound**: Two-beep alert at threshold
- **End sound**: Ascending tones when timer ends
- **Volume**: Adjustable 0-100%

## License

MIT
