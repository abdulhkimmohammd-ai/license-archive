UPDATE `licenses` SET `status` = 'archived' WHERE `status` = 'cancelled';--> statement-breakpoint
UPDATE `licenses` SET `status` = 'active' WHERE `status` = 'expiring';--> statement-breakpoint
ALTER TABLE `licenses` MODIFY COLUMN `status` enum('active','expired','suspended','archived') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `licenses` ADD `nationalIdIssuedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `nationalIdIssueGovernorate` varchar(120);--> statement-breakpoint
ALTER TABLE `licenses` ADD `nationalIdIssueDate` timestamp;--> statement-breakpoint
ALTER TABLE `licenses` ADD `birthPlace` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `birthGovernorate` varchar(120);--> statement-breakpoint
ALTER TABLE `licenses` ADD `birthDate` timestamp;
