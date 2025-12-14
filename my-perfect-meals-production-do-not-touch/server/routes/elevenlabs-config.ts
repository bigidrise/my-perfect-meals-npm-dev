import express from 'express';
const router = express.Router();

// ElevenLabs configuration endpoint
router.get('/api/elevenlabs-config', (req, res) => {
  // Return disabled state during alpha testing
  console.log('ElevenLabs config requested - DISABLED BY FEATURE FLAG');
  res.json({ 
    hasKey: false, 
    disabled: true,
    reason: 'Feature disabled during alpha testing'
  });
});

export default router;
