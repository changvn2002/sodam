import { NextResponse } from 'next/server';
import { hashPassword, issueToken } from '@/lib/server/auth';
import { badRequest, HttpError } from '@/lib/server/errors';
import { prisma } from '@/lib/server/prisma';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Email không hợp lệ');
    if (password.length < 8) throw badRequest('Mật khẩu phải có ít nhất 8 ký tự');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email này đã được đăng ký');

    const user = await prisma.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
    });
    const token = await issueToken(user.id);
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
