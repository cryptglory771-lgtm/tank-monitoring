import { NextResponse } from 'next/server';
import { saveSubscription } from '@/lib/server-store';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Data langganan tidak lengkap.' }, { status: 400 });
  }
  try {
    await saveSubscription({
      endpoint: body.endpoint,
      keys: body.keys,
      createdAt: Date.now(),
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
  } catch (err) {
    console.error('[api/push/subscribe] gagal menyimpan:', err);
    return NextResponse.json({ error: 'Gagal menyimpan langganan di server.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
