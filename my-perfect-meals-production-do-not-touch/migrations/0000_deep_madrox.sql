CREATE TABLE "adherence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"slot" text NOT NULL,
	"event_at" timestamp with time zone DEFAULT now(),
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aisle_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pattern" varchar(200) NOT NULL,
	"aisle" varchar(80) NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challenge_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challenge_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"ingredients" text[] DEFAULT ARRAY[]::text[],
	"instructions" text[] DEFAULT ARRAY[]::text[],
	"image_url" text,
	"video_url" text,
	"cooking_time" integer,
	"servings" integer DEFAULT 1,
	"estimated_calories" integer,
	"ai_scores" jsonb,
	"ai_feedback" text,
	"community_votes" integer DEFAULT 0,
	"is_winner" boolean DEFAULT false,
	"submitted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "challenge_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"vote_type" text NOT NULL,
	"voted_at" timestamp DEFAULT now(),
	CONSTRAINT "challenge_votes_submission_id_user_id_unique" UNIQUE("submission_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contest_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"meal_name" text NOT NULL,
	"photo_url" text,
	"ingredients" text[] DEFAULT ARRAY[]::text[],
	"steps" text[] DEFAULT ARRAY[]::text[],
	"submitted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contest_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" varchar NOT NULL,
	"entry_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"voted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"rules" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooking_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"rules" text[] DEFAULT ARRAY[]::text[],
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"max_calories" integer,
	"required_ingredients" text[] DEFAULT ARRAY[]::text[],
	"restricted_ingredients" text[] DEFAULT ARRAY[]::text[],
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"ai_judging_criteria" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kids_vegetables_catalog" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"kid_friendly_name" varchar NOT NULL,
	"color_category" varchar NOT NULL,
	"fun_fact" text NOT NULL,
	"recommended_intro" text NOT NULL,
	"image_url" varchar
);
--> statement-breakpoint
CREATE TABLE "kids_veggie_explorer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"vegetable_id" varchar NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"last_portion_stage" varchar(20),
	"last_try_method" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"item" text NOT NULL,
	"amount" text NOT NULL,
	"unit" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "meal_instructions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"step" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"recipe_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"meal_type" text NOT NULL,
	"servings" integer DEFAULT 1,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text NOT NULL,
	"meal_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"week_of" timestamp NOT NULL,
	"meals" jsonb,
	"total_calories" integer,
	"total_protein" integer,
	"total_carbs" integer,
	"total_fat" integer,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"meal_plan_id" varchar,
	"recipe_id" varchar,
	"recipe_name" text NOT NULL,
	"scheduled_time" text NOT NULL,
	"reminder_enabled" boolean DEFAULT true,
	"meal_type" text NOT NULL,
	"day_of_week" integer,
	"timezone" text DEFAULT 'UTC',
	"last_sent" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" date NOT NULL,
	"breakfast_at" time,
	"lunch_at" time,
	"dinner_at" time,
	"snack_times" jsonb DEFAULT '[]'::jsonb,
	"notify_breakfast" boolean DEFAULT true,
	"notify_lunch" boolean DEFAULT true,
	"notify_dinner" boolean DEFAULT true,
	"notify_snacks" boolean DEFAULT true,
	CONSTRAINT "meal_schedule_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"servings" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"source" text NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"fiber_g" integer,
	"sugar_g" integer,
	"compliance" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mental_health_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"question" text NOT NULL,
	"ai_response" text NOT NULL,
	"context" text,
	"mood" text,
	"topics" text[] DEFAULT ARRAY[]::text[],
	"follow_up" boolean DEFAULT false,
	"previous_conversation_id" varchar,
	"user_satisfaction" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"slot" text NOT NULL,
	"fire_at_utc" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"prep_time" integer,
	"cook_time" integer,
	"servings" integer DEFAULT 1,
	"calories" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"fiber" integer,
	"sugar" integer,
	"sodium" integer,
	"ingredients" jsonb,
	"instructions" text[],
	"tags" text[] DEFAULT ARRAY[]::text[],
	"meal_type" text,
	"serving_size" text,
	"dietary_restrictions" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item" text NOT NULL,
	"amount" text NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"from_meal_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"normalized" text NOT NULL,
	"category" text NOT NULL,
	"quantity" text,
	"unit" text DEFAULT '',
	"grams" integer DEFAULT 0,
	"purchased" boolean DEFAULT false,
	"notes" text,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"meal_plan_id" varchar,
	"name" text NOT NULL,
	"items" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_aisles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"aisle" varchar(80) NOT NULL,
	"order_index" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_item_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"pattern" varchar(200) NOT NULL,
	"aisle" varchar(80) NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_challenge_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"challenge_id" varchar NOT NULL,
	"joined" boolean DEFAULT true,
	"completed" boolean DEFAULT false,
	"rank" integer,
	"total_score" integer DEFAULT 0,
	"badges" text[] DEFAULT ARRAY[]::text[],
	"joined_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "user_challenge_progress_user_id_challenge_id_unique" UNIQUE("user_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "user_glycemic_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"blood_glucose" integer,
	"preferred_carbs" text[] DEFAULT ARRAY[]::text[],
	"default_portion" integer DEFAULT 100,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_time_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"times" jsonb NOT NULL,
	"notify" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_time_presets_user_id_is_default_unique" UNIQUE("user_id","is_default")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"age" integer,
	"height" integer,
	"weight" integer,
	"activity_level" text,
	"body_type" text,
	"fitness_goal" text,
	"daily_calorie_target" integer,
	"dietary_restrictions" text[] DEFAULT ARRAY[]::text[],
	"health_conditions" text[] DEFAULT ARRAY[]::text[],
	"allergies" text[] DEFAULT ARRAY[]::text[],
	"disliked_foods" text[] DEFAULT ARRAY[]::text[],
	"subscription_plan" text DEFAULT 'basic',
	"subscription_status" text DEFAULT 'active',
	"subscription_expires_at" timestamp,
	"auto_generate_weekly_plan" boolean DEFAULT true,
	"timezone" text DEFAULT 'America/Chicago',
	"phone" text,
	"phone_verified" boolean DEFAULT false,
	"sms_opt_in" boolean DEFAULT false,
	"push_tokens" jsonb DEFAULT '[]'::jsonb,
	"notify_quiet_start" time DEFAULT '22:00',
	"notify_quiet_end" time DEFAULT '06:00',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount_ml" integer NOT NULL,
	"unit" text DEFAULT 'ml' NOT NULL,
	"intake_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_meal_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_data" jsonb NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"meal_count" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'ai_meal_creator' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_json" jsonb NOT NULL,
	"last_params" jsonb NOT NULL,
	"plan_start_date" timestamp with time zone NOT NULL,
	"plan_end_date" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "weekly_plans_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(240) NOT NULL,
	"icon" varchar(60) NOT NULL,
	"criteria" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trivia_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"mindset_category" varchar(50) DEFAULT 'General' NOT NULL,
	"psych_profile_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question" varchar(1024) NOT NULL,
	"choices" jsonb NOT NULL,
	"answer_index" integer NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"explanation" varchar(1024) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trivia_round_items" (
	"round_id" uuid NOT NULL,
	"qid" uuid NOT NULL,
	"order" integer NOT NULL,
	"picked_index" integer,
	"correct" boolean,
	"answered_at" timestamp,
	CONSTRAINT "trivia_round_items_round_id_order_pk" PRIMARY KEY("round_id","order")
);
--> statement-breakpoint
CREATE TABLE "trivia_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"finished_at" timestamp,
	"round_size" integer NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"time_limit_sec" integer DEFAULT 60 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"mistakes" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" varchar(64) NOT NULL,
	"awarded_at" timestamp DEFAULT now(),
	CONSTRAINT "user_badges_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "user_trivia_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"mindset_xp" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"rounds_played" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "weekly_leaderboard" (
	"week_start" timestamp NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "weekly_leaderboard_week_start_user_id_pk" PRIMARY KEY("week_start","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_key" varchar(10) NOT NULL,
	"title" varchar(140) NOT NULL,
	"instructions" varchar(1024) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"reminded_at" timestamp,
	CONSTRAINT "user_daily_challenges_user_id_date_key_pk" PRIMARY KEY("user_id","date_key")
);
--> statement-breakpoint
ALTER TABLE "adherence_events" ADD CONSTRAINT "adherence_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisle_rules" ADD CONSTRAINT "aisle_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_comments" ADD CONSTRAINT "challenge_comments_submission_id_challenge_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."challenge_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_comments" ADD CONSTRAINT "challenge_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_cooking_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."cooking_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_submission_id_challenge_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."challenge_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_votes" ADD CONSTRAINT "contest_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_ingredients" ADD CONSTRAINT "meal_ingredients_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_instructions" ADD CONSTRAINT "meal_instructions_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_reminders" ADD CONSTRAINT "meal_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_reminders" ADD CONSTRAINT "meal_reminders_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_reminders" ADD CONSTRAINT "meal_reminders_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_schedule" ADD CONSTRAINT "meal_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mental_health_conversations" ADD CONSTRAINT "mental_health_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_from_meal_id_meals_id_fk" FOREIGN KEY ("from_meal_id") REFERENCES "public"."meals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_aisles" ADD CONSTRAINT "store_aisles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_item_rules" ADD CONSTRAINT "store_item_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_challenge_id_cooking_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."cooking_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_glycemic_settings" ADD CONSTRAINT "user_glycemic_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_time_presets" ADD CONSTRAINT "user_time_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_logs_user_created_idx" ON "water_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "water_logs_user_intake_idx" ON "water_logs" USING btree ("user_id","intake_time");