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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const consultations = await prisma.consultation.findMany({
      where: {
        arNip: decoded.user.nip,
        status: 'DONE',
        AND: [
          { notes: { not: null } },
          { notes: { not: '' } }
        ]
      },
      include: {
        taxpayer: true
      },
      orderBy: {
        endTime: 'desc'
      }
    })

    const formattedConsultations = consultations.map((consultation: any) => ({
      id: consultation.id,
      taxpayerName: consultation.taxpayer.name,
      taxpayerNip: consultation.taxpayer.npwp,
      notes: consultation.notes,
      room: consultation.room,
      duration: consultation.startTime && consultation.endTime
        ? Math.floor((new Date(consultation.endTime).getTime() - new Date(consultation.startTime).getTime()) / 1000)
        : 0,
      createdAt: consultation.startTime?.toISOString() || '',
      endedAt: consultation.endTime?.toISOString() || ''
    }))

    return NextResponse.json({ consultations: formattedConsultations })
  } catch (error) {
    console.error('Error fetching consultation notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}