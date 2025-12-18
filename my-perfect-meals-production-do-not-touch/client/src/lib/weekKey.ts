export const getWeekKey = (d = new Date()) => {
  const year = d.getFullYear();
  const firstJan = new Date(year, 0, 1);
  const day = Math.floor((d.getTime() - firstJan.getTime()) / 86400000);
  const week = Math.ceil((day + firstJan.getDay() + 1) / 7); // simple week calc
  return `${year}-W${String(week).padStart(2, "0")}`;
};