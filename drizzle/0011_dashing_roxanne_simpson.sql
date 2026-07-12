CREATE TABLE `activity_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_cache_updated_at_idx` ON `activity_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `bird_of_day_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bird_of_day_cache_updated_at_idx` ON `bird_of_day_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `dashboard_stat_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dashboard_stat_cache_updated_at_idx` ON `dashboard_stat_cache` (`updated_at`);