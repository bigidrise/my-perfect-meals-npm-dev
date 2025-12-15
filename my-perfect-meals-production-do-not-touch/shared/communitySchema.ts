import { pgTable, uuid, text, timestamp, boolean, date, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** SUPPORT GROUPS */
export const supportGroups = pgTable("support_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportGroupMembers = pgTable("support_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"), // admin|member
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("sgm_group_user_uniq").on(t.groupId, t.userId),
}));

export const supportPosts = pgTable("support_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportComments = pgTable("support_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** WELLNESS CHALLENGES */
export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isOpen: boolean("is_open").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challengeParticipants = pgTable("challenge_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id").notNull(),
  userId: uuid("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("cp_challenge_user_uniq").on(t.challengeId, t.userId),
}));

export const challengeCheckins = pgTable("challenge_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").notNull(),
  date: date("date").notNull(),
  value: integer("value").notNull().default(1), // e.g., minutes, steps, points
  note: text("note"),
});

/** LEARN TO COOK & RECIPE SHARING + CONTESTS */
export const contests = pgTable("contests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  theme: text("theme").notNull(), // e.g., "July Bake-Off", "Chili Cook-off"
  rules: text("rules").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("open"), // open|closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contestSubmissions = pgTable("contest_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contestId: uuid("contest_id").notNull(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contestVotes = pgTable("contest_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("cv_submission_user_uniq").on(t.submissionId, t.userId),
}));

// Zod Schemas
export const insertSupportGroupSchema = createInsertSchema(supportGroups);
export const insertSupportGroupMemberSchema = createInsertSchema(supportGroupMembers);
export const insertSupportPostSchema = createInsertSchema(supportPosts);
export const insertSupportCommentSchema = createInsertSchema(supportComments);

export const insertChallengeSchema = createInsertSchema(challenges);
export const insertChallengeParticipantSchema = createInsertSchema(challengeParticipants);
export const insertChallengeCheckinSchema = createInsertSchema(challengeCheckins);

export const insertContestSchema = createInsertSchema(contests);
export const insertContestSubmissionSchema = createInsertSchema(contestSubmissions);
export const insertContestVoteSchema = createInsertSchema(contestVotes);

// Types
export type SupportGroup = typeof supportGroups.$inferSelect;
export type SupportGroupMember = typeof supportGroupMembers.$inferSelect;
export type SupportPost = typeof supportPosts.$inferSelect;
export type SupportComment = typeof supportComments.$inferSelect;

export type Challenge = typeof challenges.$inferSelect;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type ChallengeCheckin = typeof challengeCheckins.$inferSelect;

export type Contest = typeof contests.$inferSelect;
export type ContestSubmission = typeof contestSubmissions.$inferSelect;
export type ContestVote = typeof contestVotes.$inferSelect;

export type InsertSupportGroup = z.infer<typeof insertSupportGroupSchema>;
export type InsertSupportGroupMember = z.infer<typeof insertSupportGroupMemberSchema>;
export type InsertSupportPost = z.infer<typeof insertSupportPostSchema>;
export type InsertSupportComment = z.infer<typeof insertSupportCommentSchema>;

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type InsertChallengeParticipant = z.infer<typeof insertChallengeParticipantSchema>;
export type InsertChallengeCheckin = z.infer<typeof insertChallengeCheckinSchema>;

export type InsertContest = z.infer<typeof insertContestSchema>;
export type InsertContestSubmission = z.infer<typeof insertContestSubmissionSchema>;
export type InsertContestVote = z.infer<typeof insertContestVoteSchema>;