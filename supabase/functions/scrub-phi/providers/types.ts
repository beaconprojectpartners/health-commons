/**
 * PhiDetector — swappable interface for PHI detection providers.
 *
 * Phase 2a implementation: AwsComprehendMedicalDetector (DetectPHI).
 * Future swap target: PresidioSidecarDetector (self-hosted on Fly.io / Cloud Run).
 *
 * The interface is intentionally narrow so a backend swap requires only
 * dropping in a new implementation; callers do not change.
 *
 * Span coordinates are ALWAYS into the ORIGINAL input text (never the
 * redacted output). This is part of the public contract of scrub-phi.
 */
export interface PhiSpan {
  type: string;        // canonical type, e.g. PERSON, ADDRESS, DATE, EMAIL, PHONE, ID, AGE, URL, PROFESSION, OTHER
  start: number;       // inclusive char offset into ORIGINAL text
  end: number;         // exclusive char offset into ORIGINAL text
  score: number;       // provider confidence 0..1
  raw_type?: string;   // provider-native type (for debugging / mapping audits)
}

export interface PhiDetectionResult {
  spans: PhiSpan[];
  provider: string;        // e.g. 'aws_comprehend_medical'
  model_version: string;   // provider-reported model version
}

export interface PhiDetector {
  detect(text: string): Promise<PhiDetectionResult>;
}
