ALTER TABLE `license_events` MODIFY COLUMN `eventType` enum('issued','updated','status_changed','document_added','archived') NOT NULL;--> statement-breakpoint
ALTER TABLE `licenses` MODIFY COLUMN `status` enum('active','expiring','expired','suspended','cancelled','archived') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `licenses` ADD `archiveReason` text;--> statement-breakpoint
ALTER TABLE `licenses` ADD `archivedBy` int;--> statement-breakpoint
ALTER TABLE `licenses` ADD `archivedAt` timestamp;