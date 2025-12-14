import React, { useState } from "react";
import { Box, Typography, TextField, Button } from "@mui/material";

interface Step3Props {
  nextStep: () => void;
  prevStep: () => void;
}

const Step3: React.FC<Step3Props> = ({ nextStep, prevStep }) => {
  const [duration, setDuration] = useState(7);

  const handleContinue = () => {
    localStorage.setItem("planDuration", duration.toString());
    nextStep();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 3: Choose Plan Duration
      </Typography>

      <TextField
        label="Duration (Days)"
        type="number"
        fullWidth
        value={duration}
        onChange={(e) => setDuration(parseInt(e.target.value))}
        inputProps={{ min: 1, max: 60 }}
        sx={{ mt: 2 }}
      />

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button onClick={prevStep}>Back</Button>
        <Button variant="contained" color="primary" onClick={handleContinue}>
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default Step3;
