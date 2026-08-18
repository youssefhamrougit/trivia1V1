# Sound Effects

Trivia1v1 uses a synthesis engine by default, but you can replace it with real audio files.

## How to add real sounds

Drop these `.mp3` files into this folder:

| File name | What it is | Suggested duration |
|---|---|---|
| `bgm.mp3` | **Background music** (loops) | 30–60s ambient track |
| `correct.mp3` | Correct answer chime | ~0.3s |
| `wrong.mp3` | Wrong answer buzzer | ~0.3s |
| `tick.mp3` | Countdown tick | ~0.05s |
| `timesup.mp3` | Time's up alert | ~0.4s |
| `match-found.mp3` | Match found notification | ~0.4s |
| `victory.mp3` | Win fanfare | ~0.8s |
| `defeat.mp3` | Loss sound | ~0.6s |

## Where to get free game sounds

- [Pixabay Sound Effects](https://pixabay.com/sound-effects/) — free, no attribution required
- [Mixkit](https://mixkit.co/free-sound-effects/) — free, no attribution required
- [Freesound](https://freesound.org/) — free with account, check licenses
- [OpenGameArt](https://opengameart.org/) — free game assets

## Format

- **MP3** is preferred (smallest file, works everywhere)
- OGG works too but not on Safari/iOS
- Keep files short (< 1 second) and small (< 50KB each)
- Normalize volume to -6dB for consistent loudness

## How it works

The sound engine checks for audio files on startup. If files are found, it uses them. If not, it falls back to the built-in synthesis engine (which sounds decent on its own).
