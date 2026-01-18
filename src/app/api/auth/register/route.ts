import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { nip, password, name, role } = await request.json()

    if (!nip || !password || !name || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (nip.length !== 9 || !/^\d+$/.test(nip)) {
      return NextResponse.json({ error: 'NIP must be 8 digits' }, { status: 400 })
    }

    const validRoles = ['AR', 'KEPALA_KANTOR', 'KEPALA_SEKSI', 'ADMIN', 'PELAKSANA']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { nip },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this NIP already exists' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        nip,
        password: hashedPassword,
        name,
        role: role as any,
      },
    })

    return NextResponse.json({ message: 'User created successfully', user: { id: user.id, nip: user.nip, name: user.name, role: user.role } })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}