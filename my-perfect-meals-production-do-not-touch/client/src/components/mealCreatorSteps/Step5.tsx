import React, { useState } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import axios from "axios";
import { useLocation } from "wouter";

interface Step5Props {
  prevStep: () => void;
}

const Step5: React.FC<Step5Props> = ({ prevStep }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const userId = localStorage.getItem("userId") || "demo-user";
      const selectedDiet = localStorage.getItem("selectedDiet") || "";
      const planDuration = parseInt(
        localStorage.getItem("planDuration") || "7",
      );
      const mealsPerDay = parseInt(localStorage.getItem("mealsPerDay") || "3");
      const snacksPerDay = parseInt(
        localStorage.getItem("snacksPerDay") || "1",
      );
      const selectedIngredients = JSON.parse(
        localStorage.getItem("selectedIngredients") || "[]",
      );

      const response = await axios.post(
        `http://localhost:5000/api/users/${userId}/meal-plan/generate`,
        {
          diet: selectedDiet,
          planDuration,
          mealsPerDay,
          snacksPerDay,
          selectedIngredients,
        },
      );

      setResult("✅ Meal plan successfully generated!");
      setTimeout(() => {
        setLocation("/comprehensive-meal-planning-revised");
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("❌ Failed to generate meal plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 5: Confirm and Generate Plan
      </Typography>

      <Typography variant="body1" mb={2}>
        Your plan will be generated based on your selections.
      </Typography>

      <Box mb={3}>
        <Button variant="outlined" onClick={prevStep}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={generatePlan}
          sx={{ ml: 2 }}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : "Generate Plan"}
        </Button>
      </Box>

      {result && <Typography color="success.main">{result}</Typography>}
      {error && <Typography color="error.main">{error}</Typography>}
    </Box>
  );
};

export default Step5;
