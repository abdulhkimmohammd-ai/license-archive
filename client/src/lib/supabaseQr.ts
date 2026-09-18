export type SupabaseQrLicenseInput = { id: string; licenseNo: string; archiveNumber: string };
export type SupabaseQrPayload = SupabaseQrLicenseInput & { version: 1; kind: "license" };

export function buildSupabaseQrPayload(input: SupabaseQrLicenseInput) {
  return JSON.stringify({ version: 1, kind: "license", id: input.id, licenseNo: input.licenseNo, archiveNumber: input.archiveNumber } satisfies SupabaseQrPayload);
}

export function parseSupabaseQrPayload(value: string): SupabaseQrPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<SupabaseQrPayload>;
    if (parsed.version !== 1 || parsed.kind !== "license" || typeof parsed.id !== "string" || typeof parsed.licenseNo !== "string" || typeof parsed.archiveNumber !== "string") return null;
    return parsed as SupabaseQrPayload;
  } catch {
    return null;
  }
}
