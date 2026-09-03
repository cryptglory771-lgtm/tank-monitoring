import { NextResponse } from 'next/server';
import { saveSubscription } from '@/lib/server-store';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Data langganan tidak lengkap.' }, { status: 400 });
  }
  await saveSubscription({
    endpoint: body.endpoint,
    keys: body.keys,
    createdAt: Date.now(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
