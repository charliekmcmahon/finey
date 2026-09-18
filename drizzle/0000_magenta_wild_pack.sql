CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`display_name` text,
	`account_type` text,
	`product_category` text,
	`product_name` text,
	`masked_number` text,
	`status` text,
	`currency` text,
	`balance_current` integer,
	`balance_available` integer,
	`balance_updated_at` integer,
	`raw_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `bank_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bank_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text,
	`provider_name` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`grant_id` text,
	`scope` text,
	`dpop_key_ref` text DEFAULT 'default' NOT NULL,
	`refresh_token_encrypted` text,
	`refresh_token_expires_at` integer,
	`consent_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_synced_at` integer,
	`last_sync_status` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `oauth_flow_state` (
	`state` text PRIMARY KEY NOT NULL,
	`code_verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` text NOT NULL,
	`trigger` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`accounts_synced` integer DEFAULT 0,
	`transactions_added` integer DEFAULT 0,
	`error_message` text,
	FOREIGN KEY (`connection_id`) REFERENCES `bank_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer,
	`currency` text,
	`description` text,
	`merchant_name` text,
	`transaction_type` text,
	`merchant_category_code` text,
	`status` text,
	`posted_at` integer,
	`executed_at` integer,
	`raw_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactions_account_executed_idx` ON `transactions` (`account_id`,`executed_at`);