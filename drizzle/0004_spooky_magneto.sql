ALTER TABLE `licenses` ADD `holderPhone` varchar(40);--> statement-breakpoint
ALTER TABLE `licenses` ADD `qualification` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `graduationPlace` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `graduationDate` timestamp;--> statement-breakpoint
ALTER TABLE `licenses` ADD `professionalLicenseNo` varchar(100);--> statement-breakpoint
ALTER TABLE `licenses` ADD `professionalLicenseIssueDate` timestamp;--> statement-breakpoint
ALTER TABLE `licenses` ADD `propertyOwnerName` varchar(255);--> statement-breakpoint
ALTER TABLE `licenses` ADD `healthOfficeIssueDate` timestamp;