CREATE TABLE `checklist_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `checklist_cache_updated_at_idx` ON `checklist_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `community_item_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_item_cache_updated_at_idx` ON `community_item_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `community_observations_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_observations_cache_updated_at_idx` ON `community_observations_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `diaries_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `diaries_list_cache_updated_at_idx` ON `diaries_list_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `diary_observations_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `diary_observations_list_cache_updated_at_idx` ON `diary_observations_list_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `observations_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observations_list_cache_updated_at_idx` ON `observations_list_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `places_dropdown_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `places_dropdown_cache_updated_at_idx` ON `places_dropdown_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `places_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `places_list_cache_updated_at_idx` ON `places_list_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `rating_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rating_cache_updated_at_idx` ON `rating_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `rating_compare_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rating_compare_cache_updated_at_idx` ON `rating_compare_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `rating_compare_header_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rating_compare_header_cache_updated_at_idx` ON `rating_compare_header_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `species_dropdown_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `species_dropdown_cache_updated_at_idx` ON `species_dropdown_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `stat_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stat_cache_updated_at_idx` ON `stat_cache` (`updated_at`);