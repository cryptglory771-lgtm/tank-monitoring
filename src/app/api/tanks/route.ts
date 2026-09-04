import { NextResponse } from 'next/server';
import { getStore, saveTanks } from '@/lib/server-store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { tanks } = await getStore();
    return NextResponse.json({ tanks });
  } catch (err) {
    console.error('[api/tanks] gagal membaca store:', err);
    return NextResponse.json({ error: 'Gagal membaca konfigurasi tanki di server.' }, { status: 500 });
  }
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
  try {
    await saveTanks(body.tanks);
  } catch (err) {
    console.error('[api/tanks] gagal menyimpan:', err);
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi tanki di server.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: body.tanks.length });
}
