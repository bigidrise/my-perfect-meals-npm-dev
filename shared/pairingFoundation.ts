import { z } from "zod";
import { PairingItem, DrinkBody, AcidityLevel, SweetnessLevel } from "./types/pairings";

// Additive Development contracts. Do not change the established Production DTOs.
export const PairingFoundationMetadata = z.object({
  version: z.literal(1),
  outcome: z.enum(["recommendation", "clarification_needed"]),
  compositionEvidence: z.literal("unverified"),
  compositionNote: z.string().min(1),
  rejectedCount: z.number().int().nonnegative(),
});

export const FoundationPairingItem = PairingItem.extend({
  name: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(600),
  servingTips: z.string().trim().min(1).max(300),
  alternatives: z.array(z.string().trim().min(1).max(100)).max(5).default([]),
});

export const WineListFoundationItem = FoundationPairingItem.extend({
  category: z.literal("wine"),
  flavorProfile: z.array(z.string().min(1).max(40)).min(3).max(6),
  body: DrinkBody,
  acidity: AcidityLevel,
  sweetness: SweetnessLevel,
});

export const WineListFoundationBestChoice = z.object({
  name: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(600),
});

export const ChefFoundationItem = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  pairingReason: z.string().trim().min(1).max(600),
  alcoholContent: z.string().max(100).optional(),
  calories: z.number().finite().nonnegative().max(4000).optional(),
  sugar: z.string().max(100).optional(),
  healthNotes: z.array(z.string().min(1).max(300)).max(10).default([]),
  medicalCompatibility: z.object({
    diabeticFriendly: z.boolean(),
    lowCalorie: z.boolean(),
    reason: z.string().max(600),
  }).optional(),
  alternatives: z.array(z.string().min(1).max(120)).max(5).optional(),
  servingTips: z.string().max(300).optional(),
});

export const PairingFoundationCards = z.array(FoundationPairingItem).min(1).max(10);
export const WineListFoundationCards = z.array(WineListFoundationItem).min(1).max(100);
export const ChefFoundationGroups = z.object({
  wine: z.array(ChefFoundationItem).max(10),
  beer: z.array(ChefFoundationItem).max(10),
  spirits: z.array(ChefFoundationItem).max(10),
}).refine(groups => Object.values(groups).some(items => items.length > 0));
