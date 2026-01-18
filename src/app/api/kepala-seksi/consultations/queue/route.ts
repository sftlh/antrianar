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

    // Get all consultations that are not completed (WAITING and IN_CONSULTATION)
    // Only for ARs in the same seksi as the kepala seksi
    const consultations = await prisma.consultation.findMany({
      where: {
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        },
        ar: {
          seksiId: kepalaSeksi.seksiId
        }
      },
      select: {
        id: true,
        status: true,
        room: true,
        createdAt: true,
        startTime: true,
        taxpayer: {
          select: {
            id: true,
            name: true,
            npwp: true,
            createdAt: true,
            assignedArNip: true,
            assignedAr: {
              select: {
                id: true,
                name: true,
                nip: true,
                lastCheckedAt: true
              }
            }
          }
        },
        ar: {
          select: {
            id: true,
            name: true,
            nip: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // WAITING first, then IN_CONSULTATION
        { createdAt: 'asc' } // Oldest first within each status
      ]
    })

    // Format the data for the frontend
    const queue = consultations.map(consultation => ({
      id: consultation.id,
      taxpayerId: consultation.taxpayer.id,
      taxpayerName: consultation.taxpayer.name,
      taxpayerNpwp: consultation.taxpayer.npwp,
      registrationTime: consultation.createdAt.toISOString(),
      status: consultation.status.toLowerCase(),
      room: consultation.room,
      arName: consultation.ar?.name || null,
      arNip: consultation.ar?.nip || null,
      assignedArName: consultation.taxpayer.assignedAr?.name || null,
      assignedArNip: consultation.taxpayer.assignedAr?.nip || null,
      arLastChecked: consultation.taxpayer.assignedAr?.lastCheckedAt?.toISOString() || null,
      startTime: consultation.startTime?.toISOString() || null,
      estimatedWaitTime: calculateEstimatedWaitTime(consultation)
    }))

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Error fetching consultation queue:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate estimated wait time in minutes
function calculateEstimatedWaitTime(consultation: {
  createdAt: Date
  status: string
  taxpayer: {
    assignedArNip: string | null
  }
}): number {
  const now = new Date()
  const consultationTime = new Date(consultation.createdAt)

  // Base wait time calculation (simplified)
  const baseWaitMinutes = Math.floor((now.getTime() - consultationTime.getTime()) / (1000 * 60))

  // If assigned to AR, reduce estimated wait time
  if (consultation.taxpayer.assignedArNip) {
    return Math.max(0, baseWaitMinutes - 5) // Assume 5 minutes faster if assigned
  }

  // If already in consultation, show time since consultation started
  if (consultation.status === 'IN_CONSULTATION') {
    return Math.max(0, baseWaitMinutes)
  }

  return Math.max(0, baseWaitMinutes)
}