// BulkSMSBD gateway integration — http://bulksmsbd.net/api/smsapi
const SMS_API_URL = "http://bulksmsbd.net/api/smsapi";

// Codes the gateway returns that mean the SMS was NOT sent successfully.
// (202 is the only success code — everything else is an error per their docs.)
const SMS_ERROR_MESSAGES: Record<string, string> = {
  "1001": "Invalid phone number",
  "1002": "Sender ID not correct or disabled",
  "1003": "Missing required fields",
  "1005": "Internal error at SMS gateway",
  "1006": "Balance validity not available",
  "1007": "Insufficient SMS balance",
  "1011": "User ID not found",
  "1012": "Masking SMS must be sent in Bengali",
  "1013": "Sender ID has no gateway for this API key",
  "1014": "Sender type not found for this sender",
  "1015": "Sender ID has no valid gateway",
  "1016": "Sender type active price info not found",
  "1017": "Sender type price info not found",
  "1018": "Account owner is disabled",
  "1019": "Account price plan is disabled",
  "1020": "Parent account not found",
  "1021": "Parent account price info not found",
  "1031": "Account not verified — contact BulkSMSBD support",
  "1032": "Server IP not whitelisted with BulkSMSBD",
};

// Bangladesh numbers only: converts "+8801XXXXXXXXX" -> "8801XXXXXXXXX" (no leading +),
// which is the format BulkSMSBD's `number` param expects.
function toGatewayNumber(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("0") && cleaned.length === 11) return `88${cleaned}`;
  return cleaned;
}

export async function sendSms(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;

  if (!apiKey || !senderId) {
    return { success: false, error: "SMS gateway is not configured (missing SMS_API_KEY/SMS_SENDER_ID)" };
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    senderid: senderId,
    number: toGatewayNumber(phone),
    message,
  });

  try {
    const res = await fetch(`${SMS_API_URL}?${params.toString()}`, { method: "GET" });
    const text = (await res.text()).trim();

    // Gateway sometimes replies with a bare numeric code ("202", "1007", ...)
    // and sometimes with a JSON object ({"response_code":1031,"error_message":"..."})
    // depending on the error — handle both shapes.
    let responseCode = text;
    let gatewayMessage: string | undefined;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "response_code" in parsed) {
        responseCode = String(parsed.response_code);
        gatewayMessage = parsed.error_message || parsed.success_message || undefined;
      }
    } catch {
      // not JSON — text is already the bare code
    }

    if (responseCode === "202") return { success: true };
    return {
      success: false,
      error: gatewayMessage || SMS_ERROR_MESSAGES[responseCode] || `SMS gateway error (code ${responseCode})`,
    };
  } catch {
    return { success: false, error: "Could not reach SMS gateway" };
  }
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
