# Ninja Timer

Professional countdown timer with customizable display for broadcasts, presentations, and live events.

<img width="600" alt="Ninja Timer - Professional countdown timer control panel with multiple timer presets, live preview, and playback controls" src="https://github.com/user-attachments/assets/45b8c3ee-0444-4457-9524-64667c94cecc" />

## Screenshots

|  |  |
|:---:|:---:|
| **Linked Timers** | **Output Display** |
| <img width="400" alt="Ninja Timer control panel showing linked timer presets with drag and drop reordering" src="https://github.com/user-attachments/assets/639ff2bc-62ee-4ffe-b254-0e0578774130" /> | <img width="400" alt="Ninja Timer fullscreen output display with countdown timer on black background" src="https://github.com/user-attachments/assets/12c55bbe-75b9-4f6a-ba23-859183f7a945" /> |
| **Timer Settings** | **Messages** |
| <img width="400" alt="Ninja Timer settings modal with duration, appearance, and sound options" src="https://github.com/user-attachments/assets/56cab9a6-8db0-430d-9c3b-85220ae22e47" /> | <img width="400" alt="Ninja Timer messages panel with formatted text overlays and color options" src="https://github.com/user-attachments/assets/8a895c33-54dc-4cc0-870e-b64ba0c513ea" /> |

## Features

### Timer Modes
- **Countdown** - Count down from a set duration
- **Count Up** - Count up from zero
- **Time of Day** - Display current time (with timezone selection)
- **Countdown + ToD** - Show countdown alongside current time
- **Count Up + ToD** - Show elapsed time alongside current time
- **Hidden** - Hide the timer display (useful for transitions)

### Timer Management
- **Multiple Timers** - Create and manage a list of timer presets
- **Drag & Drop Reordering** - Easily reorganize your timer list with auto-scroll
- **Linked Timers** - Chain timers together for automatic sequential playback
- **Quick Title Edit** - Click timer title to rename inline
- **Duplicate Timers** - Clone existing timers with one click
- **Import/Export** - Save and load timer sets as JSON files
- **Undo Support** - Revert changes with Cmd/Ctrl+Z

### Messages
- **Custom Messages** - Display text messages on the output
- **Rich Formatting** - Bold, italic, uppercase styling
- **Color Picker** - Set message text color
- **Show/Hide Toggle** - Instantly show or hide messages
- **Drag & Drop** - Reorder messages easily

### Display
- **Dual-Window Design** - Separate control panel and fullscreen output window
- **Live Preview** - See changes instantly in the control window
- **Resizable Preview** - Drag to adjust the preview section size
- **Interactive Progress Bar** - Click to seek, hover for time tooltip
- **Warning Zones** - Yellow and orange zones as timer nears end
- **Timer Segments** - See linked timer segments visualized in the progress bar
- **Overtime Mode** - Continues counting after timer ends (shows +M:SS in red)
- **Auto-Fit Text** - Timer and message text automatically scales to fill the display

### Appearance
- **Text Color** - Full color picker for timer text
- **Stroke** - Adjustable outline width and color
- **Shadow** - Configurable drop shadow size and color
- **Background Color** - Solid background color for output

### Controls
- **Flash Effect** - Grab attention with a synchronized white glow animation
- **Blackout Toggle** - Instantly black out the output display
- **Visibility Toggle** - Show/hide timer without affecting running state
- **Keyboard Shortcuts** - Control from any window

### Sound
- **End Sound** - Audio notification when timer completes
- **Volume Control** - Adjustable per-timer volume
- **Default Sound Setting** - Set default for new timers in app settings

### App Settings
- **Time of Day Format** - Choose 12-hour or 24-hour display
- **Timezone Selection** - 26 global timezones with GMT offsets
- **Confirm Delete** - Toggle delete confirmation dialogs
- **Window Behavior** - Keep output and/or control window always on top
- **New Timer Defaults** - Configure default mode, duration, format, and sound
- **Auto Update Check** - Checks for updates on startup

## Getting Started

### Prerequisites
- Node.js 18 or later
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/madebyjamstudios/ninja-timer.git
cd ninja-timer

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

The DMG will be created in the `dist/` folder.

## Usage

1. Launch Ninja Timer with `npm start`
2. Click **+ Add Timer** to create a new timer
3. Configure timer settings (mode, duration, appearance)
4. Click the **Output** button to open the display window
5. Use the play/pause buttons or keyboard shortcuts to control timers
6. Press **Escape** in the output window for fullscreen

### Timer List Controls
| Icon | Action |
|------|--------|
| Clock | Select timer (load without starting) |
| Rewind | Reset active timer |
| Play/Pause | Start, pause, or resume timer |
| Gear | Edit timer configuration |
| Three dots | More options (duplicate, delete) |
| Link | Connect to next timer for auto-play |

### Progress Bar
- **Click anywhere** to seek to that position
- **Hover** to see time at cursor position
- **Markers** show time remaining at 25%, 50%, 75%
- **Warning zones** turn yellow then orange as time runs out

## Keyboard Shortcuts

### Control Window
| Shortcut | Action |
|----------|--------|
| Space | Play/Pause toggle |
| Cmd/Ctrl+Z | Undo last change |

### Output Window
| Shortcut | Action |
|----------|--------|
| Space | Play/Pause toggle |
| R | Reset timer |
| B | Toggle blackout |
| Escape | Toggle fullscreen |

## Project Structure

```
ninja-timer/
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
│   └── shared/          # Shared utilities
│       ├── base.css
│       ├── constants.js
│       ├── timer.js
│       ├── timerState.js
│       ├── renderTimer.js
│       ├── renderMessage.js
│       └── validation.js
├── icon.icns            # App icon
├── package.json
└── README.md
```

## Configuration Options

### Timer Settings
| Option | Description |
|--------|-------------|
| **Title** | Name for the timer preset |
| **Mode** | Countdown, Count Up, Time of Day, or combinations |
| **Duration** | Timer length (MM:SS or HH:MM:SS) |
| **Format** | Display format: HH:MM:SS or MM:SS |
| **Warning Yellow** | When to turn timer yellow (default: 1:00) |
| **Warning Orange** | When to turn timer orange (default: 0:15) |

### Appearance Settings
| Option | Description |
|--------|-------------|
| **Text Color** | Timer text color |
| **Stroke Width** | Outline thickness (0-20px) |
| **Stroke Color** | Outline color |
| **Shadow Size** | Drop shadow blur (0-50px) |
| **Shadow Color** | Shadow color |
| **Background** | Output window background color |

### Sound Settings
| Option | Description |
|--------|-------------|
| **End Sound** | Play sound when timer completes |
| **Volume** | Sound volume level (0-100%) |

## Version History

### v2.0.0
- Messages system with rich formatting
- Interactive progress bar with seek
- Timezone selection for Time of Day
- Warning zones (yellow/orange) on progress bar
- Auto-scroll during drag and drop
- Visibility toggle for timer display
- Improved flash animation sync

### v1.0.0
- Initial release
- Countdown, count up, and time of day modes
- Linked timers for sequential playback
- Customizable appearance
- Dual-window design

## License

MIT

## Credits

Made with care by JAM Studios
