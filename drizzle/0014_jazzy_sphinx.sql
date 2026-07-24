CREATE TABLE `territory_detail_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `territory_detail_cache_updated_at_idx` ON `territory_detail_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `territory_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `territory_list_cache_updated_at_idx` ON `territory_list_cache` (`updated_at`);