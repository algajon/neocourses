CREATE TABLE IF NOT EXISTS "lesson_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ln_user_lesson_idx" ON "lesson_notes" ("user_id","lesson_id");