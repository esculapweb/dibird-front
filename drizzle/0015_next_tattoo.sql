CREATE TABLE `observation_places_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observation_places_cache_updated_at_idx` ON `observation_places_cache` (`updated_at`);