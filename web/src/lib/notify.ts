/**
 * Email (SMTP) + WhatsApp delivery for booking confirmations / Finished sheet.
 * When providers are unset: log to console and return mode "console".
 */

import nodemailer from "nodemailer";

export type NotifyResult = {
  channel: "email" | "whatsapp";
  mode: "console" | "sent" | "skipped" | "error";
  detail: string;
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Normalize SA / international numbers to E.164 digits (no +). */
export function normalizeWhatsAppDigits(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  // South Africa local: 0XXXXXXXXX → 27XXXXXXXXX
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `27${digits.slice(1)}`;
  }
  return digits;
}

export async function sendSmtpEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<NotifyResult> {
  const to = params.to.trim();
  if (!to) {
    return {
      channel: "email",
      mode: "skipped",
      detail: "No email address on the player profile.",
    };
  }

  const host = env("SMTP_HOST");
  if (!host) {
    console.info(
      `[notify:email] To: ${to}\nSubject: ${params.subject}\n\n${params.text}`,
    );
    return {
      channel: "email",
      mode: "console",
      detail: `Email logged to console (SMTP_HOST unset) for ${to}.`,
    };
  }

  const port = Number(env("SMTP_PORT") || "587");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = env("FROM_EMAIL") || user || "noreply@localhost";

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to,
      subject: params.subject,
      text: params.text,
    });
    return {
      channel: "email",
      mode: "sent",
      detail: `Email sent to ${to}.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP send failed";
    console.error(`[notify:email] Failed for ${to}:`, msg);
    return {
      channel: "email",
      mode: "error",
      detail: `Email failed for ${to}: ${msg}`,
    };
  }
}

/** @deprecated alias — use sendSmtpEmail */
export const sendEmailNotify = sendSmtpEmail;

async function sendMetaWhatsApp(
  toDigits: string,
  text: string,
): Promise<NotifyResult> {
  const token = env("WHATSAPP_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_ID") || env("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) {
    return {
      channel: "whatsapp",
      mode: "skipped",
      detail: "Meta WhatsApp env not set.",
    };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: text.slice(0, 4096) },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[notify:whatsapp:meta] ${res.status} ${body}`);
    return {
      channel: "whatsapp",
      mode: "error",
      detail: `Meta WhatsApp failed (${res.status}) for ${toDigits}.`,
    };
  }
  return {
    channel: "whatsapp",
    mode: "sent",
    detail: `WhatsApp sent via Meta to ${toDigits}.`,
  };
}

async function sendTwilioWhatsApp(
  toDigits: string,
  text: string,
): Promise<NotifyResult> {
  const sid = env("TWILIO_SID");
  const token = env("TWILIO_TOKEN");
  let from = env("TWILIO_WHATSAPP_FROM");
  if (!sid || !token || !from) {
    return {
      channel: "whatsapp",
      mode: "skipped",
      detail: "Twilio WhatsApp env not set.",
    };
  }
  if (!from.startsWith("whatsapp:")) {
    from = `whatsapp:${from.startsWith("+") ? from : `+${from}`}`;
  }
  const to = `whatsapp:+${toDigits}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({
    From: from,
    To: to,
    Body: text.slice(0, 1600),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[notify:whatsapp:twilio] ${res.status} ${body}`);
    return {
      channel: "whatsapp",
      mode: "error",
      detail: `Twilio WhatsApp failed (${res.status}) for ${toDigits}.`,
    };
  }
  return {
    channel: "whatsapp",
    mode: "sent",
    detail: `WhatsApp sent via Twilio to ${toDigits}.`,
  };
}

export async function sendWhatsAppNotify(params: {
  to: string;
  text: string;
}): Promise<NotifyResult> {
  const raw = params.to.trim();
  if (!raw) {
    return {
      channel: "whatsapp",
      mode: "skipped",
      detail: "No WhatsApp number on the player profile.",
    };
  }

  const digits = normalizeWhatsAppDigits(raw);
  if (digits.length < 10) {
    return {
      channel: "whatsapp",
      mode: "error",
      detail: `Invalid WhatsApp number "${raw}".`,
    };
  }

  const hasMeta =
    Boolean(env("WHATSAPP_TOKEN")) &&
    Boolean(env("WHATSAPP_PHONE_ID") || env("WHATSAPP_PHONE_NUMBER_ID"));
  const hasTwilio =
    Boolean(env("TWILIO_SID")) &&
    Boolean(env("TWILIO_TOKEN")) &&
    Boolean(env("TWILIO_WHATSAPP_FROM"));

  if (!hasMeta && !hasTwilio) {
    console.info(`[notify:whatsapp] To: ${digits}\n\n${params.text}`);
    return {
      channel: "whatsapp",
      mode: "console",
      detail: `WhatsApp logged to console (provider unset) for ${digits}.`,
    };
  }

  // Prefer Meta Cloud when configured; fall back to Twilio.
  if (hasMeta) {
    const meta = await sendMetaWhatsApp(digits, params.text);
    if (meta.mode === "sent" || !hasTwilio) return meta;
    console.warn(
      `[notify:whatsapp] Meta failed; trying Twilio. ${meta.detail}`,
    );
  }
  return sendTwilioWhatsApp(digits, params.text);
}

export async function notifyEmailAndWhatsApp(params: {
  email?: string | null;
  whatsapp?: string | null;
  subject: string;
  text: string;
}): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];
  results.push(
    await sendSmtpEmail({
      to: params.email ?? "",
      subject: params.subject,
      text: params.text,
    }),
  );
  results.push(
    await sendWhatsAppNotify({
      to: params.whatsapp ?? "",
      text: `${params.subject}\n\n${params.text}`,
    }),
  );
  return results;
}

/**
 * Booking confirmation / Finished sheet notify entry point.
 * Sends the full tee sheet summary to the player's email + WhatsApp.
 */
export async function sendBookingConfirmation(params: {
  email?: string | null;
  whatsapp?: string | null;
  subject: string;
  text: string;
}): Promise<NotifyResult[]> {
  return notifyEmailAndWhatsApp(params);
}
