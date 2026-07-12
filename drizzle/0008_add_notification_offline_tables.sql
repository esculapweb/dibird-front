CREATE TABLE `notification_read_overlay` (
	`id` integer PRIMARY KEY NOT NULL,
	`read_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_unread_count_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_unread_count_cache_updated_at_idx` ON `notification_unread_count_cache` (`updated_at`);--> statement-breakpoint
CREATE TABLE `notifications_list_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_list_cache_updated_at_idx` ON `notifications_list_cache` (`updated_at`);