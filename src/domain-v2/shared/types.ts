/**
 * Shared types for domain-v2
 */

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
  documentVersion?: string;
  publishedAt?: string;
  accessedAt: string;
  page?: string;
  note?: string;
}

export type VerificationStatus = "verified" | "unverified" | "conflicted" | "unsupported";

export interface DomainWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DomainError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
