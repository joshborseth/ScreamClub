CREATE TABLE `signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`confirmation_sent_at` text
);
