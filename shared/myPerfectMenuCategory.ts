import { z } from "zod";

export const myPerfectMenuCategorySchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MyPerfectMenuCategory = z.infer<typeof myPerfectMenuCategorySchema>;