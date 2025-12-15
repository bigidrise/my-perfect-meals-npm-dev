// import foodLogsRouter from "./foodLogs"; // TEMPORARILY DISABLED - File missing
// ...
// app.use(foodLogsRouter); // TEMPORARILY DISABLED - File missing

import diabetesRoutes from "./diabetes";
import glp1ShotsRoutes from "./glp1Shots";
import glp1Router from "./glp1";
import patientAssignmentRoutes from "./patientAssignment";

// ...

app.use("/api/diabetes", diabetesRoutes);
  app.use("/api/glp1-shots", glp1ShotsRoutes);
  app.use("/api/glp1", glp1Router);
  app.use("/api/patients", patientAssignmentRoutes);