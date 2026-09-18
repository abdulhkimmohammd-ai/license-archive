CREATE TABLE `license_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseId` int NOT NULL,
	`eventType` enum('issued','updated','status_changed','document_added') NOT NULL,
	`note` text,
	`performedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `license_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `license_events_license_idx` ON `license_events` (`licenseId`);