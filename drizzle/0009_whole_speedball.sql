CREATE TABLE `static_page_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `static_page_cache_updated_at_idx` ON `static_page_cache` (`updated_at`);