CREATE TABLE `country` (
	`value` integer PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`code` text NOT NULL,
	`favourite` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timezone` (
	`value` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL
);
