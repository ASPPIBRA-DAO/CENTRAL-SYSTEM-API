CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`status` text DEFAULT 'success',
	`ip_address` text,
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`description` text NOT NULL,
	`total_value` integer NOT NULL,
	`total_installments` integer,
	`status` text DEFAULT 'active',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_token_unique` ON `password_resets` (`token`);--> statement-breakpoint
CREATE TABLE `post_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`content` text NOT NULL,
	`likes` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_post_user_favorite` ON `post_favorites` (`post_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`cover_url` text,
	`category` text DEFAULT 'Geral',
	`tags` text,
	`total_views` integer DEFAULT 0,
	`total_shares` integer DEFAULT 0,
	`total_favorites` integer DEFAULT 0,
	`time_to_read` integer DEFAULT 5,
	`is_featured` integer DEFAULT false,
	`is_trending` integer DEFAULT false,
	`publish` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_posts_slug` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_posts_publish` ON `posts` (`publish`);--> statement-breakpoint
CREATE INDEX `idx_posts_category` ON `posts` (`category`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`avatar_url` text,
	`mfa_secret` text,
	`mfa_enabled` integer DEFAULT false,
	`kyc_status` text DEFAULT 'none',
	`role` text DEFAULT 'citizen',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`address` text NOT NULL,
	`chain_id` integer NOT NULL,
	`is_primary` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_address_unique` ON `wallets` (`address`);