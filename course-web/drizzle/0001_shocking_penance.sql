CREATE TABLE IF NOT EXISTS "flashcard_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"flashcard_id" text NOT NULL,
	"ease" real DEFAULT 2.5,
	"interval_days" integer DEFAULT 0,
	"due_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"lesson_id" text,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "review_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "assigned_by_id" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "required" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fr_user_due_idx" ON "flashcard_reviews" ("user_id","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lc_course_idx" ON "lesson_comments" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notifications" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tm_team_user_idx" ON "team_members" ("team_id","user_id");