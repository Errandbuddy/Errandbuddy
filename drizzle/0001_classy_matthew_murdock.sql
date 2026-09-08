CREATE TABLE `mock_balances` (
	`public_key` text PRIMARY KEY NOT NULL,
	`balance_xlm` real DEFAULT 10000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_account` (
	`id` text PRIMARY KEY DEFAULT 'platform' NOT NULL,
	`public_key` text NOT NULL,
	`encrypted_secret` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_account_public_key_unique` ON `platform_account` (`public_key`);