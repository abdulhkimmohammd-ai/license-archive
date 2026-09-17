ALTER TABLE `licenses` ADD `previousLicenseNo` varchar(100);--> statement-breakpoint
ALTER TABLE `licenses` ADD `previousLicenseIssuedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `previousLicenseIssueDate` timestamp;