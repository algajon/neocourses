CREATE TABLE IF NOT EXISTS "learner_badges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"badge_key" text NOT NULL,
	"earned_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learner_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"current_streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_activity_date" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "learner_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learner_badges" ADD CONSTRAINT "learner_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learner_stats" ADD CONSTRAINT "learner_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lb_user_badge_idx" ON "learner_badges" ("user_id","badge_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lb_user_idx" ON "learner_badges" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ls_user_idx" ON "learner_stats" ("user_id");