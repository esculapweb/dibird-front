CREATE TABLE `diary_species_ids_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `diary_species_ids_cache_updated_at_idx` ON `diary_species_ids_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `map_preview_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `map_preview_cache_updated_at_idx` ON `map_preview_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `user_profile_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_profile_cache_updated_at_idx` ON `user_profile_cache` (`updated_at`);--> statement-breakpoint
ALTER TABLE `profile` ADD `pending_avatar_uri` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `pending_avatar_op` text;