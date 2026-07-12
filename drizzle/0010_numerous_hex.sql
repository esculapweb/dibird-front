CREATE TABLE `alert_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'synced' NOT NULL,
	`last_error` text,
	`updated_at` integer NOT NULL
);
