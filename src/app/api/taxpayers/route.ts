import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { npwp, name } = await request.json()

    if (!npwp || !name) {
      return NextResponse.json({ error: 'NPWP and name are required' }, { status: 400 })
    }

    const taxpayer = await prisma.taxpayer.create({
      data: {
        npwp,
        name,
      },
    })

    return NextResponse.json({ message: 'Taxpayer added successfully', taxpayer })
  } catch (error) {
    console.error('Error adding taxpayer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as {
      user: {
        id: number
        nip: string
        role: string
        name: string
      }
    }

    const taxpayers = await prisma.taxpayer.findMany({
      include: {
        assignedAr: true,
        consultations: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ taxpayers })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}