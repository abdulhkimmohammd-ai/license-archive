import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userAccessStatusValues = ["pending", "approved", "blocked"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "archivist", "admin"]).default("user").notNull(),
  accessStatus: mysqlEnum("accessStatus", userAccessStatusValues).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const licenseStatusValues = ["active", "expired", "suspended", "archived"] as const;
export const facilityTypeValues = ["warehouse", "pharmacy"] as const;
export const qualificationLevelValues = ["diploma", "bachelor"] as const;
export const graduationInstitutionTypeValues = ["institute", "university"] as const;
export const documentTypeValues = ["national_id", "license", "qualification", "directive", "opening_request"] as const;
export const notificationKindValues = ["days_90", "days_30", "days_7"] as const;
export const licenseEventTypeValues = ["issued", "updated", "status_changed", "archive_number_changed", "document_added", "archived", "deleted", "restored"] as const;

export const licenses = mysqlTable(
  "licenses",
  {
    id: int("id").autoincrement().primaryKey(),
    licenseNo: varchar("licenseNo", { length: 100 }).notNull(),
    facilityName: varchar("facilityName", { length: 255 }).notNull(),
    facilityType: mysqlEnum("facilityType", facilityTypeValues).notNull(),
    holderName: varchar("holderName", { length: 255 }).notNull(),
    holderNationalId: varchar("holderNationalId", { length: 100 }).notNull(),
    nationalIdIssuedBy: varchar("nationalIdIssuedBy", { length: 255 }),
    nationalIdIssueGovernorate: varchar("nationalIdIssueGovernorate", { length: 120 }),
    nationalIdIssueDate: timestamp("nationalIdIssueDate"),
    birthPlace: varchar("birthPlace", { length: 255 }),
    birthGovernorate: varchar("birthGovernorate", { length: 120 }),
    birthDate: timestamp("birthDate"),
    holderPhone: varchar("holderPhone", { length: 40 }),
    qualification: varchar("qualification", { length: 255 }),
    qualificationLevel: mysqlEnum("qualificationLevel", qualificationLevelValues),
    graduationPlace: varchar("graduationPlace", { length: 255 }),
    graduationCountry: varchar("graduationCountry", { length: 120 }),
    graduationInstitute: varchar("graduationInstitute", { length: 255 }),
    graduationInstitutionType: mysqlEnum("graduationInstitutionType", graduationInstitutionTypeValues),
    graduationDate: timestamp("graduationDate"),
    professionalLicenseNo: varchar("professionalLicenseNo", { length: 100 }),
    professionalLicenseIssueDate: timestamp("professionalLicenseIssueDate"),
    previousLicenseNo: varchar("previousLicenseNo", { length: 100 }),
    previousLicenseIssuedBy: varchar("previousLicenseIssuedBy", { length: 255 }),
    previousLicenseIssueDate: timestamp("previousLicenseIssueDate"),
    siteInspectionFormNo: varchar("siteInspectionFormNo", { length: 100 }),
    siteInspectionFormDate: timestamp("siteInspectionFormDate"),
    committeeMinutesNo: varchar("committeeMinutesNo", { length: 100 }),
    committeeMinutesDate: timestamp("committeeMinutesDate"),
    feeReceiptNo: varchar("feeReceiptNo", { length: 100 }),
    feeReceiptDate: timestamp("feeReceiptDate"),
    governorate: varchar("governorate", { length: 120 }).notNull(),
    address: text("address"),
    street: varchar("street", { length: 255 }),
    area: varchar("area", { length: 255 }),
    district: varchar("district", { length: 255 }),
    propertyOwnerName: varchar("propertyOwnerName", { length: 255 }),
    archiveNumber: varchar("archiveNumber", { length: 120 }).notNull(),
    archiveDate: timestamp("archiveDate"),
    archiveOfficerName: varchar("archiveOfficerName", { length: 255 }),
    issueDate: timestamp("issueDate").notNull(),
    healthOfficeIssueDate: timestamp("healthOfficeIssueDate"),
    healthOfficeDirectorName: varchar("healthOfficeDirectorName", { length: 255 }),
    healthOfficeDirectorGovernorate: varchar("healthOfficeDirectorGovernorate", { length: 120 }),
    licenseDeliveryDate: timestamp("licenseDeliveryDate"),
    licenseDeliveryRecipientName: varchar("licenseDeliveryRecipientName", { length: 255 }),
    licenseDeliverySignature: varchar("licenseDeliverySignature", { length: 255 }),
    licenseDeliveryFingerprint: varchar("licenseDeliveryFingerprint", { length: 255 }),
    expiryDate: timestamp("expiryDate").notNull(),
    status: mysqlEnum("status", licenseStatusValues).default("active").notNull(),
    notes: text("notes"),
    archiveReason: text("archiveReason"),
    archivedBy: int("archivedBy"),
    archivedAt: timestamp("archivedAt"),
    deletedAt: timestamp("deletedAt"),
    deletedBy: int("deletedBy"),
    deletionReason: text("deletionReason"),
    createdBy: int("createdBy").notNull(),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("licenses_license_no_unique").on(table.licenseNo),
    uniqueIndex("licenses_archive_number_unique").on(table.archiveNumber),
    index("licenses_status_idx").on(table.status),
    index("licenses_facility_type_idx").on(table.facilityType),
    index("licenses_governorate_idx").on(table.governorate),
    index("licenses_expiry_date_idx").on(table.expiryDate),
    index("licenses_created_at_idx").on(table.createdAt),
    index("licenses_deleted_at_idx").on(table.deletedAt),
  ],
);

export const archiveSequences = mysqlTable("archive_sequences", {
  facilityType: mysqlEnum("facilityType", facilityTypeValues).primaryKey(),
  currentValue: int("currentValue").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const archiveNumberHistory = mysqlTable(
  "archive_number_history",
  {
    id: int("id").autoincrement().primaryKey(),
    archiveNumber: varchar("archiveNumber", { length: 120 }).notNull(),
    licenseId: int("licenseId").notNull(),
    facilityType: mysqlEnum("facilityType", facilityTypeValues).notNull(),
    sequence: int("sequence").notNull(),
    assignedBy: int("assignedBy").notNull(),
    changeReason: text("changeReason").notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("archive_number_history_number_unique").on(table.archiveNumber),
    index("archive_number_history_license_idx").on(table.licenseId),
  ],
);

export const idempotencyRequests = mysqlTable("idempotency_requests", {
  idempotencyKey: varchar("idempotencyKey", { length: 64 }).primaryKey(),
  actorId: int("actorId").notNull(),
  requestHash: varchar("requestHash", { length: 128 }).notNull(),
  licenseId: int("licenseId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    licenseId: int("licenseId").notNull(),
    documentType: mysqlEnum("documentType", documentTypeValues).notNull(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 100 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    uploadedBy: int("uploadedBy").notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  table => [
    index("documents_license_id_idx").on(table.licenseId),
    uniqueIndex("documents_license_type_unique").on(table.licenseId, table.documentType),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_actor_idx").on(table.actorId),
  ],
);

export const licenseEvents = mysqlTable(
  "license_events",
  {
    id: int("id").autoincrement().primaryKey(),
    licenseId: int("licenseId").notNull(),
    eventType: mysqlEnum("eventType", licenseEventTypeValues).notNull(),
    note: text("note"),
    performedBy: int("performedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("license_events_license_idx").on(table.licenseId),
  ],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    licenseId: int("licenseId").notNull(),
    kind: mysqlEnum("kind", notificationKindValues).notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("notifications_license_kind_unique").on(table.licenseId, table.kind),
    index("notifications_license_idx").on(table.licenseId),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type License = typeof licenses.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type LicenseEvent = typeof licenseEvents.$inferSelect;
export type ArchiveNumberHistory = typeof archiveNumberHistory.$inferSelect;
