ALTER TABLE `license_events` MODIFY COLUMN `eventType` enum('issued','updated','status_changed','document_added','archived','deleted','restored') NOT NULL;--> statement-breakpoint
ALTER TABLE `licenses` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `licenses` ADD `deletedBy` int;--> statement-breakpoint
ALTER TABLE `licenses` ADD `deletionReason` text;--> statement-breakpoint
CREATE INDEX `licenses_deleted_at_idx` ON `licenses` (`deletedAt`);