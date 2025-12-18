import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schema for creating a physician report
const createPhysicianReportSchema = z.object({
  userId: z.string(),
  patientName: z.string().optional(),
  healthProfile: z.object({
    hasDiabetes: z.boolean(),
    diabetesType: z.string().optional(),
    allergies: z.array(z.string()),
    medicalConditions: z.array(z.string()),
    medications: z.array(z.string()),
    dietaryRestrictions: z.array(z.string()),
  }),
  mealPlan: z.array(z.object({
    name: z.string(),
    description: z.string(),
    slot: z.string().optional(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    kcal: z.number(),
    ingredients: z.array(z.string()),
    medicalBadges: z.array(z.object({
      type: z.string(),
      reason: z.string(),
    })).optional(),
  })),
  protocol: z.string().optional(),
  clinicalNotes: z.string().optional(),
});

// POST /api/physician-reports - Create a new physician medical report
router.post('/', async (req, res) => {
  try {
    const reportData = createPhysicianReportSchema.parse(req.body);
    const report = await storage.createPhysicianReport(reportData);
    
    res.json({
      success: true,
      report: {
        id: report.id,
        accessCode: report.accessCode,
        reportDate: report.reportDate,
      },
      // Generate shareable link
      shareableLink: `${req.protocol}://${req.get('host')}/physician-report/${report.accessCode}`,
    });
  } catch (error) {
    console.error('Error creating physician report:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid report data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create physician report' });
    }
  }
});

// GET /api/physician-reports/view/:accessCode - View a physician report (public for doctors)
router.get('/view/:accessCode', async (req, res) => {
  try {
    const { accessCode } = req.params;
    const report = await storage.getPhysicianReport(accessCode);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found or expired' });
    }
    
    // Track view
    await storage.trackPhysicianReportView(accessCode);
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching physician report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// GET /api/physician-reports/user/:userId - Get all reports for a user (private)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reports = await storage.getUserPhysicianReports(userId);
    
    // Return summary info only (not full report data)
    const reportSummaries = reports.map(report => ({
      id: report.id,
      accessCode: report.accessCode,
      reportDate: report.reportDate,
      protocol: report.protocol,
      viewCount: report.viewCount,
      lastViewedAt: report.lastViewedAt,
      isActive: report.isActive,
    }));
    
    res.json(reportSummaries);
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ error: 'Failed to fetch user reports' });
  }
});

// DELETE /api/physician-reports/:id - Deactivate a report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await storage.getPhysicianReportById(id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Deactivate instead of delete (soft delete)
    report.isActive = false;
    report.updatedAt = new Date();
    
    res.json({ success: true, message: 'Report deactivated' });
  } catch (error) {
    console.error('Error deactivating report:', error);
    res.status(500).json({ error: 'Failed to deactivate report' });
  }
});

export default router;
