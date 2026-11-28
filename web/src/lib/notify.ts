/**
 * Delivery helpers. When providers are unset, log + return console status
 * (same pattern as verification OTP email).
 */

export type NotifyResult = {
  channel: "email" | "whatsapp";
  mode: "console" | "sent" | "skipped";
  detail: string;
};

export async function sendEmailNotify(params: {
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

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.info(
      `[notify:email] To: ${to}\nSubject: ${params.subject}\n\n${params.text}`,
    );
    return {
      channel: "email",
      mode: "console",
      detail: `Email logged to console (SMTP unset) for ${to}.`,
    };
  }

  // SMTP_HOST set but delivery not wired — same stance as sendVerificationEmail.
  console.warn(
    `[notify:email] SMTP_HOST is set but SMTP send is not wired. Logging instead for ${to}.`,
  );
  console.info(
    `[notify:email] To: ${to}\nSubject: ${params.subject}\n\n${params.text}`,
  );
  return {
    channel: "email",
    mode: "console",
    detail: `Email logged (SMTP not wired) for ${to}.`,
  };
}

export async function sendWhatsAppNotify(params: {
  to: string;
  text: string;
}): Promise<NotifyResult> {
  const to = params.to.trim();
  if (!to) {
    return {
      channel: "whatsapp",
      mode: "skipped",
      detail: "No WhatsApp number on the player profile.",
    };
  }

  const token =
    process.env.WHATSAPP_TOKEN?.trim() ||
    process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.WHATSAPP_FROM?.trim();

  if (!token || !phoneId) {
    console.info(`[notify:whatsapp] To: ${to}\n\n${params.text}`);
    return {
      channel: "whatsapp",
      mode: "console",
      detail: `WhatsApp logged to console (provider unset) for ${to}.`,
    };
  }

  console.warn(
    `[notify:whatsapp] Provider env present but WhatsApp send is not wired. Logging instead for ${to}.`,
  );
  console.info(`[notify:whatsapp] To: ${to}\n\n${params.text}`);
  return {
    channel: "whatsapp",
    mode: "console",
    detail: `WhatsApp logged (provider not wired) for ${to}.`,
  };
}

export async function notifyEmailAndWhatsApp(params: {
  email?: string | null;
  whatsapp?: string | null;
  subject: string;
  text: string;
}): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];
  results.push(
    await sendEmailNotify({
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
