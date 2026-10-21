import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, corsPreflightResponse, jsonResponse } from "../_shared/cors.ts";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipHits = new Map<string, { count: number; windowStart: number }>();

function normalizeMobile(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  return null;
}

function decodeBase64Payload(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const b64 = match[2];
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return null;
  }
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

async function uploadPrivateFile(
  supabase: ReturnType<typeof createClient>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await supabase.storage.from("admission-photos").upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (!rateLimitOk(ip)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server not configured" }, 500);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

        if (body.website && String(body.website).trim()) {
          return jsonResponse({ success: true, form_number: null });
        }

        // Disabled for public use — admissions are created via the admin panel.
        return jsonResponse(
          { error: "Public admission intake is disabled. Use the admin admissions form." },
          410,
        );

  const studentName = String(body.student_name ?? "").trim();
  const mobile = normalizeMobile(body.student_mobile ?? "");
  const agreed = body.agreed_to_terms === true;
  const preferredLanguage = body.preferred_language === "en" ? "en" : "gu";

  if (!studentName) return jsonResponse({ error: "Student name is required" }, 400);
  if (!mobile) return jsonResponse({ error: "Enter a valid 10-digit Indian mobile number" }, 400);
  if (!agreed) return jsonResponse({ error: "You must agree to the rules before submitting" }, 400);

  const currentAddress = String(body.current_address ?? "").trim();
  const permanentAddress = String(body.permanent_address ?? "").trim();
  const classStartTime = String(body.class_start_time ?? "").trim();
  const classEndTime = String(body.class_end_time ?? "").trim();

  if (!currentAddress) return jsonResponse({ error: "Current address is required" }, 400);
  if (!permanentAddress) return jsonResponse({ error: "Permanent address is required" }, 400);
  if (!classStartTime) return jsonResponse({ error: "Class start time is required" }, 400);
  if (!classEndTime) return jsonResponse({ error: "Class end time is required" }, 400);

  const photoPayload = body.student_photo;
  if (!photoPayload || typeof photoPayload !== "string") {
    return jsonResponse({ error: "Student photo is required" }, 400);
  }

  const signaturePayload = body.student_signature;
  if (!signaturePayload || typeof signaturePayload !== "string") {
    return jsonResponse({ error: "Signature is required" }, 400);
  }

  const photoDecoded = decodeBase64Payload(photoPayload);
  if (!photoDecoded) return jsonResponse({ error: "Invalid photo upload" }, 400);
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(photoDecoded.mime)) {
    return jsonResponse({ error: "Photo must be JPG or PNG" }, 400);
  }
  if (photoDecoded.bytes.length > MAX_PHOTO_BYTES) {
    return jsonResponse({ error: "Photo must be under 2 MB" }, 400);
  }

  const sigDecoded = decodeBase64Payload(signaturePayload);
  if (!sigDecoded) return jsonResponse({ error: "Invalid signature" }, 400);
  if (!sigDecoded.mime.startsWith("image/")) {
    return jsonResponse({ error: "Invalid signature image" }, 400);
  }
  if (sigDecoded.bytes.length > 512_000) {
    return jsonResponse({ error: "Signature image is too large" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: formNumberRaw, error: seqErr } = await supabase.rpc("next_admission_form_number");
  if (seqErr || formNumberRaw == null) {
    return jsonResponse({ error: "Could not assign form number" }, 500);
  }
  const formNumber = String(formNumberRaw);

  const admissionId = crypto.randomUUID();
  const photoExt = photoDecoded.mime.includes("png") ? "png" : "jpg";
  const photoPath = `photos/${admissionId}.${photoExt}`;
  const sigPath = `signatures/${admissionId}.png`;

  const photoUp = await uploadPrivateFile(
    supabase,
    photoPath,
    photoDecoded.bytes,
    photoDecoded.mime,
  );
  if (photoUp.error) return jsonResponse({ error: "Photo upload failed" }, 500);

  const sigUp = await uploadPrivateFile(
    supabase,
    sigPath,
    sigDecoded.bytes,
    sigDecoded.mime,
  );
  if (sigUp.error) return jsonResponse({ error: "Signature upload failed" }, 500);

  const now = new Date().toISOString();
  const row = {
    id: admissionId,
    form_number: formNumber,
    student_name: studentName,
    student_mobile: mobile,
    student_photo_url: photoPath,
    student_signature_url: sigPath,
    current_address: currentAddress,
    permanent_address: permanentAddress,
    reference_details: String(body.reference_details ?? "").trim() || null,
    class_start_time: classStartTime,
    class_end_time: classEndTime,
    preferred_language: preferredLanguage,
    agreed_to_terms: true,
    agreed_at: now,
    status: "pending",
    submitted_at: now,
  };

  const { error: insertErr } = await supabase.from("admissions").insert(row);
  if (insertErr) {
    return jsonResponse({ error: insertErr.message }, 500);
  }

  return jsonResponse({ success: true, form_number: formNumber });
});
