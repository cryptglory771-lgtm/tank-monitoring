import { NextResponse } from 'next/server';
import { getStore, removeSubscriptions } from '@/lib/server-store';

export const runtime = 'nodejs';

function authorised(req: Request) {
  const token = process.env.WORKER_TOKEN;
  return Boolean(token) && req.headers.get('x-worker-token') === token;
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Token worker tidak cocok.' }, { status: 401 });
  }
  const { tanks, subscriptions } = await getStore();
  return NextResponse.json({ tanks, subscriptions });
}

/** Worker melaporkan endpoint yang sudah kedaluwarsa (HTTP 404/410 dari push service). */
export async function DELETE(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Token worker tidak cocok.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  await removeSubscriptions(body?.endpoints ?? []);
  return NextResponse.json({ ok: true });
}
