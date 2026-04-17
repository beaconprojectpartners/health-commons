# scrub-phi

PHI detection + redaction for user-submitted medical terms (Phase 2a of the moderation system).

## Pipeline

1. **Regex pre-pass** — phone, email, SSN, MRN-like, URLs (defense in depth, cheap).
2. **PHI detector** — `PhiDetector` interface; Phase 2a uses **AWS Comprehend Medical `DetectPHI`**.
3. **Eponym allowlist filter** — `PERSON` / `PROFESSION` spans matching `phi_eponym_allowlist` (e.g. Crohn, Sjögren) are dropped.
4. **Stage 3 LLM adjudication** — spans with confidence `< 0.85` are sent to Lovable AI (`google/gemini-2.5-flash`) with the eponym list as context. Ambiguous → redact (fail closed).
5. **Merge + redact** — overlapping spans are merged; output is the original string with each span replaced by `[REDACTED:<TYPE>]`.

## Span coordinates

`spans[*].start` and `spans[*].end` are **character offsets into the ORIGINAL input text**, NOT the redacted output. This is part of the public contract.

## Swappable provider interface

PHI detection lives behind `providers/types.ts` (`PhiDetector`). The Phase 2a implementation is `providers/aws_comprehend_medical.ts`.

**Future swap target:** self-hosted [Microsoft Presidio](https://microsoft.github.io/presidio/) on Fly.io / Cloud Run / Render. To swap:

1. Add `providers/presidio_sidecar.ts` implementing `PhiDetector`.
2. Change the one line in `index.ts` (`makeDetector()`).
3. No other code changes.

### When to evaluate the swap

Comprehend Medical pricing: **~$0.0014 per 100 characters** for DetectPHI (≈ $1.40 / 100k chars).

| Monthly volume | Approx. monthly cost | Action |
|---|---|---|
| < 5M chars (~70k submissions @ 70 chars) | < $70 | Stay on Comprehend |
| 5M – 21M chars | $70 – $300 | Monitor; flag in admin dashboard |
| **> 21M chars (~$300/mo)** | > $300 | **Evaluate Presidio sidecar** |
| > 50M chars | > $700 | Migrate to Presidio |

The admin dashboard (Phase 2e) surfaces daily call count, character volume, and estimated cost as the trigger signal.

## Region & BAA

- **Default region:** `us-east-1`. Failover region: `us-west-2`. Both support Comprehend Medical.
- **BAA status:** DxCommons is **not currently a covered entity** under HIPAA, so no Business Associate Agreement is in place with AWS. If DxCommons later becomes a covered entity (e.g. partners with a clinical site, accepts identified PHI by design), execute AWS's BAA **before** scaling beyond research-pilot status. AWS BAA covers Comprehend Medical when the account is enrolled.

## Credentials & IAM

Three Supabase secrets are required:

| Secret | Purpose |
|---|---|
| `AWS_COMPREHEND_KEY_ID` | AWS access key ID for the scoped IAM user |
| `AWS_COMPREHEND_SECRET` | AWS secret access key |
| `AWS_COMPREHEND_REGION` | Region; defaults to `us-east-1` if unset |

The IAM user must be scoped to **only** `comprehendmedical:DetectPHI`. Recommended IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DetectPhiOnly",
      "Effect": "Allow",
      "Action": "comprehendmedical:DetectPHI",
      "Resource": "*"
    }
  ]
}
```

Do not use root credentials, broad-access keys, or any policy that grants additional `comprehendmedical:*` actions.

## Error handling

- One retry with exponential backoff (250ms, then 1s) on 5xx / 429 / network errors.
- 4xx (auth/validation) is not retried.
- On final failure: function returns **HTTP 503** with `{ error: "phi_detector_unavailable", error_code }`.
- A `redaction_log` row is written with `provider='aws_comprehend_medical'`, `counts={}`, and the `error_code` populated (`comprehend_5xx`, `comprehend_throttled`, `comprehend_4xx`, `comprehend_network`).
- The submission is **never** stored unredacted as a fallback (Phase 2b's `submit-pending-term` enforces this end-to-end).

## Logging policy

- No `console.log` / `console.error` ever sees the original text.
- The local `text` variable is cleared (`body.text = ""`) once `redacted_text` is built, before any further await.
- All errors carry only `{ counts, provider, model_version, phase, error_code }`.
- Supabase Edge Function default body capture: verified disabled.

## Schema dependency

Reads `phi_eponym_allowlist`. Writes `redaction_log` (counts only — never text).
