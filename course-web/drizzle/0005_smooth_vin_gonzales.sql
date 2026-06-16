ALTER TABLE "courses" ADD COLUMN "pricing_model" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "paid" boolean DEFAULT false NOT NULL;