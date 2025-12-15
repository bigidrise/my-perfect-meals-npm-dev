import React, { useState } from "react";
import { Box, Typography, TextField, Button, Grid } from "@mui/material";

interface Step2Props {
  nextStep: () => void;
  prevStep: () => void;
}

const Step2: React.FC<Step2Props> = ({ nextStep, prevStep }) => {
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [snacksPerDay, setSnacksPerDay] = useState(1);

  const handleContinue = () => {
    localStorage.setItem("mealsPerDay", mealsPerDay.toString());
    localStorage.setItem("snacksPerDay", snacksPerDay.toString());
    nextStep();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 2: Choose Daily Meal Structure
      </Typography>

      <Grid container spacing={2} mt={1}>
        <Grid item xs={6}>
          <TextField
            label="Meals per Day"
            type="number"
            fullWidth
            value={mealsPerDay}
            onChange={(e) => setMealsPerDay(parseInt(e.target.value))}
            inputProps={{ min: 1, max: 6 }}
          />
        </Grid>

        <Grid item xs={6}>
          <TextField
            label="Snacks per Day"
            type="number"
            fullWidth
            value={snacksPerDay}
            onChange={(e) => setSnacksPerDay(parseInt(e.target.value))}
            inputProps={{ min: 0, max: 4 }}
          />
        </Grid>
      </Grid>

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button onClick={prevStep}>Back</Button>
        <Button variant="contained" color="primary" onClick={handleContinue}>
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default Step2;
