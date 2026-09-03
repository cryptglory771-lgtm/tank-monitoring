import { NextResponse } from 'next/server';
import { getStore, saveTanks } from '@/lib/server-store';

export const runtime = 'nodejs';

export async function GET() {
  const { tanks } = await getStore();
  return NextResponse.json({ tanks });
}

/**
 * PWA mengirim ulang seluruh daftar tanki setiap ada perubahan, supaya
 * worker menilai dengan aturan yang sama persis dengan yang dilihat operator.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.tanks)) {
    return NextResponse.json({ error: 'Daftar tanki tidak valid.' }, { status: 400 });
  }
  await saveTanks(body.tanks);
  return NextResponse.json({ ok: true, count: body.tanks.length });
}
