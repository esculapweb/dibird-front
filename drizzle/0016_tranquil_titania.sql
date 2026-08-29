CREATE TABLE `observation_photo` (
	`id` integer PRIMARY KEY NOT NULL,
	`observation_id` integer NOT NULL,
	`server_id` integer,
	`local_uri` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`client_request_id` text,
	`op` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observation_photo_observation_idx` ON `observation_photo` (`observation_id`);