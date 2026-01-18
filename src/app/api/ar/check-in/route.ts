import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as {
      user: {
        id: number
        nip: string
        role: string
        name: string
      }
    }

    if (decoded.user.role !== 'AR') {
      return NextResponse.json({ error: 'Only ARs can check in' }, { status: 403 })
    }

    // Update the AR's last checked timestamp
    await prisma.user.update({
      where: { id: decoded.user.id },
      data: { lastCheckedAt: new Date() },
    })

    return NextResponse.json({ message: 'Checked in successfully' })
  } catch (error) {
    console.error('Error checking in AR:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}