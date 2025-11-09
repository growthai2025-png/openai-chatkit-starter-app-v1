import type { NextRequest, NextResponse } from 'next/server';

const WORKFLOW_ID = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHATKIT_API_BASE = process.env.CHATKIT_API_BASE ?? "https://api.openai.com";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    if (!WORKFLOW_ID || !OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing workflow ID or API key" }, { status: 500 });
    }

    // 1️⃣ Create ChatKit session
    const sessionRes = await fetch(`${CHATKIT_API_BASE}/v1/chatkit/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
      body: JSON.stringify({
        workflow: { id: WORKFLOW_ID },
        chatkit_configuration: { file_upload: { enabled: false } },
      }),
    });

    const sessionJson = await sessionRes.json();
    if (!sessionRes.ok || !sessionJson.client_secret) {
      return NextResponse.json({ error: "Failed to create ChatKit session", details: sessionJson }, { status: 500 });
    }

    const clientSecret = sessionJson.client_secret;

    // 2️⃣ Send message to workflow
    const chatRes = await fetch(`${CHATKIT_API_BASE}/v1/chatkit/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientSecret}`,
      },
      body: JSON.stringify({
        input: { text: message },
        workflow: { id: WORKFLOW_ID },
      }),
    });

    const chatJson = await chatRes.json();
    if (!chatRes.ok || !chatJson.output_text) {
      return NextResponse.json({ error: "Failed to get reply from workflow", details: chatJson }, { status: 500 });
    }

    // Return the workflow reply
    return NextResponse.json({ output_text: chatJson.output_text });
  } catch (err) {
    console.error("growth-coach API error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
