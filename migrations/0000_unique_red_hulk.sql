CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`wallet_address` text,
	`wallet_provider` text DEFAULT 'system',
	`nonce` text,
	`credential_status` text DEFAULT 'pending',
	`credential_id` text,
	`credential_issued_at` integer,
	`voting_power` integer DEFAULT 0,
	`token_balance_synced_at` integer,
	`terms_accepted_at` integer,
	`role` text DEFAULT 'citizen',
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_wallet_address_unique` ON `users` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_wallet` ON `users` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_users_credential` ON `users` (`credential_status`);