CREATE TABLE `escrow_events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`type` text NOT NULL,
	`stellar_tx_hash` text,
	`amount_xlm` real NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_profile_id` text NOT NULL,
	`category_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`lat` real,
	`lng` real,
	`price_xlm` real NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`escrow_tx_hash` text,
	`release_tx_hash` text,
	`refund_tx_hash` text,
	`dispute_reason` text,
	`dispute_raised_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_profile_id`) REFERENCES `provider_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `provider_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`bio` text NOT NULL,
	`years_experience` integer DEFAULT 0 NOT NULL,
	`hourly_rate_xlm` real NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`avatar_emoji` text DEFAULT '🧰' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_profiles_user_id_unique` ON `provider_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`reviewee_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_job_id_unique` ON `reviews` (`job_id`);--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT '🛠️' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_name_unique` ON `service_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_slug_unique` ON `service_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text NOT NULL,
	`city` text,
	`lat` real,
	`lng` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wallet_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`stellar_public_key` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`network` text DEFAULT 'testnet' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_accounts_user_id_unique` ON `wallet_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_accounts_stellar_public_key_unique` ON `wallet_accounts` (`stellar_public_key`);