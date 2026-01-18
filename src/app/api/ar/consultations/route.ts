/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

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

    if (decoded.user.role !== 'AR') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const consultations = await prisma.consultation.findMany({
      where: {
        arNip: decoded.user.nip,
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        }
      },
      include: {
        taxpayer: {
          select: {
            id: true,
            npwp: true,
            name: true,
            createdAt: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Transform to maintain consistent response structure
    const taxpayers = consultations.map((consultation: any) => ({
      ...consultation.taxpayer,
      consultationId: consultation.id,
      consultationStatus: consultation.status,
      room: consultation.room,
      startTime: consultation.startTime,
      notes: consultation.notes,
    }))

    return NextResponse.json({ taxpayers })
  } catch (error) {
    console.error('Error fetching AR consultations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}