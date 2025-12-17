CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource` text,
	`status` text DEFAULT 'success',
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`address` text NOT NULL,
	`chain_id` integer NOT NULL,
	`is_primary` integer DEFAULT false,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_address_unique` ON `wallets` (`address`);--> statement-breakpoint
CREATE INDEX `idx_wallets_user_id` ON `wallets` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_wallets_address` ON `wallets` (`address`);--> statement-breakpoint
DROP INDEX `users_wallet_address_unique`;--> statement-breakpoint
DROP INDEX `idx_users_wallet`;--> statement-breakpoint
DROP INDEX `idx_users_credential`;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `kyc_status` text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `users` ADD `aal_level` integer DEFAULT 1;--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `wallet_address`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `wallet_provider`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `nonce`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `credential_status`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `credential_id`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `credential_issued_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `voting_power`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `token_balance_synced_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `terms_accepted_at`;