export type CheckResult =
  | { exists: false }
  | { exists: true; role: string; provider: string };

export type GuidanceVariant =
  | "not-found"
  | "wrong-provider-google"
  | "wrong-provider-email"
  | "wrong-role-owner"
  | "wrong-role-vet"
  | "wrong-role-admin"
  | "wrong-password"
  | "email-not-confirmed";

export interface Guidance {
  variant: GuidanceVariant;
  value: string;
  href?: string;
}
