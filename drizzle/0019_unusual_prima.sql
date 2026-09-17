CREATE TABLE `archive_number_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`archiveNumber` varchar(120) NOT NULL,
	`licenseId` int NOT NULL,
	`facilityType` enum('warehouse','pharmacy') NOT NULL,
	`sequence` int NOT NULL,
	`assignedBy` int NOT NULL,
	`changeReason` text NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_number_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `archive_number_history_number_unique` UNIQUE(`archiveNumber`)
);
--> statement-breakpoint
CREATE TABLE `archive_sequences` (
	`facilityType` enum('warehouse','pharmacy') NOT NULL,
	`currentValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `archive_sequences_facilityType` PRIMARY KEY(`facilityType`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_requests` (
	`idempotencyKey` varchar(64) NOT NULL,
	`actorId` int NOT NULL,
	`requestHash` varchar(128) NOT NULL,
	`licenseId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_requests_idempotencyKey` PRIMARY KEY(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `license_events` MODIFY COLUMN `eventType` enum('issued','updated','status_changed','archive_number_changed','document_added','archived','deleted','restored') NOT NULL;--> statement-breakpoint
ALTER TABLE `licenses` ADD CONSTRAINT `licenses_archive_number_unique` UNIQUE(`archiveNumber`);--> statement-breakpoint
CREATE INDEX `archive_number_history_license_idx` ON `archive_number_history` (`licenseId`);