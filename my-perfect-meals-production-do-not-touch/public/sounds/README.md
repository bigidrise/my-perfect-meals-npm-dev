# FitBrain Rush Audio Files

This directory contains the audio files for the FitBrain Rush game.

## Required Files

Place the following audio files in this directory:

1. **music-loop.mp3** - Background music (short, seamless loop, 200-500 KB recommended, 128kbps MP3)
2. **correct.mp3** - Sound effect for correct answers
3. **wrong.mp3** - Sound effect for incorrect answers
4. **streak.mp3** - Sound effect for streak achievements (5+ correct in a row)
5. **round-win.mp3** - Sound effect for completing a round
6. **final-fanfare.mp3** - Sound effect for completing the entire game

## Audio Specifications

- **Format**: MP3
- **Bitrate**: 128kbps is sufficient for game audio
- **Loop file**: Ensure `music-loop.mp3` is seamlessly loopable (no gaps)
- **File size**: Keep files small for fast loading (under 500 KB each)

## Testing

After adding the files, you can test them by:

1. Opening the FitBrain Rush game
2. Using the **Audio Test** panel in the lobby
3. Verifying each sound plays correctly

## Mobile/iOS Notes

- On iPhone/iPad, ensure the ringer switch is ON (not in silent mode)
- Audio requires a user gesture (tap/click) to start on most mobile browsers
- The system will automatically request permission on first interaction
