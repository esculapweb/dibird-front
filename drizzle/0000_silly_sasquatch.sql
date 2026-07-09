CREATE TABLE `mutation_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`user` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`is_active` integer NOT NULL,
	`avatar` text,
	`avatar_thumbnail` text,
	`private` integer NOT NULL,
	`private_diary` integer NOT NULL,
	`registration_ip` text,
	`timezone` text,
	`territory` integer,
	`status` text DEFAULT 'synced' NOT NULL,
	`updated_at` integer NOT NULL
);
