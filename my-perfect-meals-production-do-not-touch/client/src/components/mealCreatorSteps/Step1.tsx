import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

interface Step1Props {
  nextStep: () => void;
}

const Step1: React.FC<Step1Props> = ({ nextStep }) => {
  const [selectedDiet, setSelectedDiet] = useState("");

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedDiet(event.target.value as string);
  };

  const handleContinue = () => {
    localStorage.setItem("selectedDiet", selectedDiet); // store for next steps
    nextStep();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 1: Choose Your Diet (Optional)
      </Typography>

      <FormControl fullWidth margin="normal">
        <InputLabel>Select Diet</InputLabel>
        <Select value={selectedDiet} onChange={handleChange}>
          <MenuItem value="">No Preference</MenuItem>
          <MenuItem value="Keto">Keto</MenuItem>
          <MenuItem value="Low Carb">Low Carb</MenuItem>
          <MenuItem value="High Protein">High Protein</MenuItem>
          <MenuItem value="Paleo">Paleo</MenuItem>
          <MenuItem value="Vegan">Vegan</MenuItem>
          <MenuItem value="Vegetarian">Vegetarian</MenuItem>
          <MenuItem value="Mediterranean">Mediterranean</MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="contained"
        color="primary"
        disabled={!selectedDiet && selectedDiet !== ""}
        onClick={handleContinue}
        sx={{ mt: 2 }}
      >
        Continue
      </Button>
    </Box>
  );
};

export default Step1;
