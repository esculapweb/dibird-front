CREATE TABLE `diary` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`op` text,
	`status` text DEFAULT 'synced' NOT NULL,
	`last_error` text,
	`updated_at` integer NOT NULL
);
