CREATE TABLE `taxon_detail_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `taxon_detail_cache_updated_at_idx` ON `taxon_detail_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `taxon_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `taxon_list_cache_updated_at_idx` ON `taxon_list_cache` (`updated_at`);