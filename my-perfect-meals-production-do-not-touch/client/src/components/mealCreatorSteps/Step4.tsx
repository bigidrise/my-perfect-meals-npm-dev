import React, { useState } from "react";
import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Button,
  Grid,
} from "@mui/material";

interface Step4Props {
  nextStep: () => void;
  prevStep: () => void;
}

const availableIngredients = [
  "Chicken",
  "Beef",
  "Fish",
  "Turkey",
  "Tofu",
  "Eggs",
  "Lentils",
  "Shrimp",
  "Quinoa",
  "Beans",
  "Tempeh",
];

const Step4: React.FC<Step4Props> = ({ nextStep, prevStep }) => {
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  const handleToggle = (ingredient: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((item) => item !== ingredient)
        : [...prev, ingredient],
    );
  };

  const handleContinue = () => {
    localStorage.setItem(
      "selectedIngredients",
      JSON.stringify(selectedIngredients),
    );
    nextStep();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 4: Select Preferred Ingredients
      </Typography>

      <Grid container spacing={2} mt={1}>
        {availableIngredients.map((ingredient) => (
          <Grid item xs={6} sm={4} key={ingredient}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedIngredients.includes(ingredient)}
                  onChange={() => handleToggle(ingredient)}
                />
              }
              label={ingredient}
            />
          </Grid>
        ))}
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

export default Step4;
