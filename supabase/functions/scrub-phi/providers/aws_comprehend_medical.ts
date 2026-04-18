/**
 * AWS Comprehend Medical — DetectPHI implementation of the PhiDetector interface.
 *
 * Why DetectPHI specifically: it is purpose-built for the 18 HIPAA identifiers
 * and returns structured entity types that map cleanly to our redaction schema.
 * We do NOT use the general-purpose DetectEntitiesV2 endpoint.
 *
 * Region: configurable via AWS_COMPREHEND_REGION env (default us-east-1).
 *         us-east-1 and us-west-2 both support Comprehend Medical.
 *
 * BAA: DxCommons is not currently a covered entity. No BAA executed with AWS.
 *      See ../README.md "Region & BAA" — execute AWS BAA before scaling beyond
 *      the research-pilot stage.
 *
 * IAM: Credentials must be scoped to ONLY `comprehendmedical:DetectPHI`.
 *      See ../README.md for the policy template.
 *
 * Failure handling: One retry with exponential backoff (250ms, 1s).
 * On second failure the caller treats the submission as failed (we never fall
 * back to storing raw text — see scrub-phi index.ts).
 */
import type { PhiDetector, PhiDetectionResult, PhiSpan } from "./types.ts";

interface ComprehendEntity {
  Id: number;
  BeginOffset: number;
  EndOffset: number;
  Score: number;
  Text: string;
  Category: string;       // e.g. "PROTECTED_HEALTH_INFORMATION"
  Type: string;           // e.g. "NAME", "ADDRESS", "DATE", "EMAIL", "ID", "PHONE_OR_FAX", ...
  Traits?: Array<{ Name: string; Score: number }>;
}

interface ComprehendDetectPhiResponse {
  Entities: ComprehendEntity[];
  ModelVersion: string;
  PaginationToken?: string;
}

const COMPREHEND_TYPE_MAP: Record<string, string> = {
  NAME: "PERSON",
  ADDRESS: "ADDRESS",
  AGE: "AGE",
  DATE: "DATE",
  EMAIL: "EMAIL",
  ID: "ID",
  PHONE_OR_FAX: "PHONE",
  PROFESSION: "PROFESSION",
  URL: "URL",
  CONTACT_POINT: "PHONE",
};

function mapType(raw: string): string {
  return COMPREHEND_TYPE_MAP[raw] ?? "OTHER";
}

// --- Minimal AWS SigV4 signer for the comprehendmedical:DetectPHI POST ---
// We avoid pulling the full AWS SDK into the Deno edge runtime; this is a
// scoped, single-endpoint signer.

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedRequest(
  region: string,
  accessKey: string,
  secretKey: string,
  body: string,
): Promise<Request> {
  const service = "comprehendmedical";
  const host = `${service}.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const target = "ComprehendMedical_20181030.DetectPHI";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest =
    `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
    `${algorithm} Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Request(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "host": host,
      "x-amz-date": amzDate,
      "x-amz-target": target,
      "authorization": authorization,
    },
    body,
  });
}

export class AwsComprehendMedicalDetector implements PhiDetector {
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(opts?: { region?: string; accessKey?: string; secretKey?: string }) {
    this.region = opts?.region ?? Deno.env.get("AWS_COMPREHEND_REGION") ?? "us-east-1";
    this.accessKey = opts?.accessKey ?? Deno.env.get("AWS_COMPREHEND_KEY_ID") ?? "";
    this.secretKey = opts?.secretKey ?? Deno.env.get("AWS_COMPREHEND_SECRET") ?? "";
    if (!this.accessKey || !this.secretKey) {
      throw new Error("aws_comprehend_credentials_missing");
    }
  }

  async detect(text: string): Promise<PhiDetectionResult> {
    const body = JSON.stringify({ Text: text });

    const callOnce = async (): Promise<ComprehendDetectPhiResponse> => {
      const req = await signedRequest(this.region, this.accessKey, this.secretKey, body);
      const res = await fetch(req);
      if (!res.ok) {
        const status = res.status;
        // AWS error bodies contain only error metadata (no echo of input text).
        // Safe to log for diagnosing auth/region/permission issues.
        const errBody = await res.text().catch(() => "");
        console.error(`[comprehend] HTTP ${status} region=${this.region} body=${errBody}`);
        const err = new Error(`comprehend_http_${status}`);
        // @ts-ignore augment
        err.status = status;
        throw err;
      }
      return await res.json() as ComprehendDetectPhiResponse;
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await callOnce();
        const spans: PhiSpan[] = (data.Entities ?? []).map((e) => ({
          type: mapType(e.Type),
          raw_type: e.Type,
          start: e.BeginOffset,
          end: e.EndOffset,
          score: e.Score,
        }));
        return {
          spans,
          provider: "aws_comprehend_medical",
          model_version: data.ModelVersion ?? "unknown",
        };
      } catch (err) {
        lastErr = err;
        // Retry on 5xx / throttling / network. Bail on 4xx (auth/validation).
        // @ts-ignore status
        const status = (err && (err as { status?: number }).status) ?? 0;
        if (status >= 400 && status < 500 && status !== 429) break;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    }
    // Translate to a stable error_code for redaction_log.
    // @ts-ignore status
    const status = (lastErr && (lastErr as { status?: number }).status) ?? 0;
    const code =
      status === 429 ? "comprehend_throttled" :
      status >= 500 ? "comprehend_5xx" :
      status >= 400 ? "comprehend_4xx" :
      "comprehend_network";
    const e = new Error(code);
    // @ts-ignore
    e.error_code = code;
    throw e;
  }
}
