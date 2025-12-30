export const runtime = "edge";

async function hmacSHA256Hex(
  body: ArrayBuffer,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, body);

  return [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return new Response("Secret missing", { status: 500 });
    }

    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return new Response("No signature", { status: 401 });
    }

    const body = await req.arrayBuffer();

    const digest = `sha256=${await hmacSHA256Hex(body, secret)}`;
    if (!timingSafeEqual(digest, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let payload: any;

    if (contentType.includes("application/json")) {
      payload = JSON.parse(new TextDecoder().decode(body));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = new TextDecoder().decode(body);
      const params = new URLSearchParams(text);
      payload = JSON.parse(params.get("payload") || "{}");
    } else {
      return new Response("Unsupported content type", { status: 415 });
    }

    const event = req.headers.get("x-github-event") || "unknown";
    console.log("GitHub event:", event);

    if (event === "ping") {
      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Webhook handler error", { status: 500 });
  }
}
