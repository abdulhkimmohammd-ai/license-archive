CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseId` int NOT NULL,
	`documentType` enum('national_id','license','qualification','directive','opening_request') NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_license_type_unique` UNIQUE(`licenseId`,`documentType`)
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseNo` varchar(100) NOT NULL,
	`facilityName` varchar(255) NOT NULL,
	`facilityType` enum('warehouse','pharmacy') NOT NULL,
	`holderName` varchar(255) NOT NULL,
	`holderNationalId` varchar(100) NOT NULL,
	`governorate` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`archiveNumber` varchar(120) NOT NULL,
	`issueDate` timestamp NOT NULL,
	`expiryDate` timestamp NOT NULL,
	`status` enum('active','expiring','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdBy` int NOT NULL,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `licenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `licenses_license_no_unique` UNIQUE(`licenseNo`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseId` int NOT NULL,
	`kind` enum('days_90','days_30','days_7') NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_license_kind_unique` UNIQUE(`licenseId`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','archivist','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorId`);--> statement-breakpoint
CREATE INDEX `documents_license_id_idx` ON `documents` (`licenseId`);--> statement-breakpoint
CREATE INDEX `licenses_status_idx` ON `licenses` (`status`);--> statement-breakpoint
CREATE INDEX `licenses_facility_type_idx` ON `licenses` (`facilityType`);--> statement-breakpoint
CREATE INDEX `licenses_governorate_idx` ON `licenses` (`governorate`);--> statement-breakpoint
CREATE INDEX `licenses_expiry_date_idx` ON `licenses` (`expiryDate`);--> statement-breakpoint
CREATE INDEX `notifications_license_idx` ON `notifications` (`licenseId`);