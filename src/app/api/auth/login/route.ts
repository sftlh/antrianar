import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { nip, password } = await request.json()

    if (!nip || !password) {
      return NextResponse.json({ error: 'NIP and password are required' }, { status: 400 })
    }

    // Find user by NIP
    const user = await prisma.user.findUnique({
      where: { nip },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid NIP or password' }, { status: 401 })
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid NIP or password' }, { status: 401 })
    }

    // Create JWT token
    const token = jwt.sign(
      {
        user: {
          id: user.id,
          nip: user.nip,
          role: user.role,
          name: user.name,
        },
      },
      process.env.SECRET_KEY!,
      { expiresIn: '1h' }
    )

    // Set cookie
    const response = NextResponse.json({ message: 'Login successful' })
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}