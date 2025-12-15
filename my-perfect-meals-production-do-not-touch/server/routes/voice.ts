import { Router } from 'express';
import multer from 'multer';
import { VoiceCommandParser } from '../voiceCommandParser';
import { VoiceCommandExecutor } from '../voiceCommandExecutor';
import { SERVER_AVATAR_FEATURES } from '../config/avatarFlags';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Voice transcription endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!SERVER_AVATAR_FEATURES.VOICE_TRANSCRIPTION_ENABLED) {
    return res.status(503).json({ 
      error: 'Voice transcription disabled during alpha testing',
      transcript: '' 
    });
  }

  const { buffer } = req.file;
  const voiceCommandParser = new VoiceCommandParser();
  const transcript = await voiceCommandParser.transcribeAudio(buffer);

  res.json({ transcript });
});

// Voice command parsing endpoint
router.post('/parse', async (req, res) => {
  if (!SERVER_AVATAR_FEATURES.VOICE_COMMAND_PARSING_ENABLED) {
    return res.status(503).json({ 
      action: 'error',
      speech: 'Voice commands are temporarily disabled during alpha testing'
    });
  }

  const { transcript } = req.body;
  const voiceCommandParser = new VoiceCommandParser();
  const command = voiceCommandParser.parseTranscript(transcript);

  res.json({ command });
});

// Voice command execution endpoint
router.post('/execute', async (req, res) => {
  const { command } = req.body;
  const voiceCommandExecutor = new VoiceCommandExecutor();
  const result = await voiceCommandExecutor.executeCommand(command);

  res.json({ result });
});

export default router;