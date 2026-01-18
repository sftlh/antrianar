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

    if (decoded.user.role !== 'KEPALA_SEKSI') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get the kepala seksi's seksi
    const kepalaSeksi = await prisma.user.findUnique({
      where: { id: decoded.user.id },
      select: {
        seksiId: true
      }
    })

    if (!kepalaSeksi?.seksiId) {
      return NextResponse.json({ error: 'Kepala seksi tidak memiliki seksi yang ditugaskan' }, { status: 400 })
    }

    // Get recent consultations (last 10)
    const recentConsultations = await prisma.consultation.findMany({
      take: 10,
      orderBy: {
        startTime: 'desc'
      },
      include: {
        taxpayer: {
          select: {
            name: true,
            npwp: true
          }
        },
        ar: {
          select: {
            name: true
          }
        }
      },
      where: {
        ar: {
          role: 'AR',
          seksiId: kepalaSeksi.seksiId // Only show consultations handled by ARs in the same seksi
        }
      }
    })

    // Format the data for the frontend
    const consultations = recentConsultations.map(consultation => ({
      id: consultation.id,
      taxpayerName: consultation.taxpayer.name,
      taxpayerNpwp: consultation.taxpayer.npwp,
      arName: consultation.ar?.name || 'N/A',
      room: consultation.room || 'N/A',
      status: consultation.status.toLowerCase(),
      startTime: consultation.startTime.toISOString(),
      endTime: consultation.endTime?.toISOString(),
      duration: consultation.endTime && consultation.startTime
        ? Math.round((consultation.endTime.getTime() - consultation.startTime.getTime()) / (1000 * 60))
        : null
    }))

    return NextResponse.json({ consultations })
  } catch (error) {
    console.error('Error fetching recent consultations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}