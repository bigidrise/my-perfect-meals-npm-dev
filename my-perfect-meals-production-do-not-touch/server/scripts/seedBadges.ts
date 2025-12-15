import { seedBadges } from "../services/badgeService";

async function run() {
  await seedBadges();
  console.log("Badges seeded successfully");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });