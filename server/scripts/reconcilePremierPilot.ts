import { reconcilePremierPilot } from "../services/premierPilotReconciliation";

const approvedByUserId = process.env.PREMIER_APPROVED_BY_USER_ID;
if (!approvedByUserId) {
  throw new Error("Set PREMIER_APPROVED_BY_USER_ID to an existing system-admin user ID.");
}

const result = await reconcilePremierPilot(approvedByUserId);
console.log(JSON.stringify({
  ...result,
  // Invitation tokens are intentionally never printed. They can be resent
  // through the authenticated Business Suite after publishing.
}, null, 2));
process.exit(0);