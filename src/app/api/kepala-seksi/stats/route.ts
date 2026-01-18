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

    // Get current date for filtering today's consultations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get section statistics
    const [
      activeConsultations,
      completedToday,
      waitingTaxpayers,
      totalARs,
      totalConsultations,
      avgConsultationTime
    ] = await Promise.all([
      // Active consultations (ongoing)
      prisma.consultation.count({
        where: {
          status: 'IN_CONSULTATION',
          ar: {
            role: 'AR',
            seksiId: kepalaSeksi.seksiId
          }
        }
      }),

      // Completed consultations today
      prisma.consultation.count({
        where: {
          status: 'DONE',
          endTime: {
            gte: today,
            lt: tomorrow
          },
          ar: {
            role: 'AR',
            seksiId: kepalaSeksi.seksiId
          }
        }
      }),

      // Waiting taxpayers (consultations with WAITING status)
      prisma.consultation.count({
        where: {
          status: 'WAITING',
          ar: {
            role: 'AR',
            seksiId: kepalaSeksi.seksiId
          }
        }
      }),

      // Total ARs (Account Representatives) in the same seksi
      prisma.user.count({
        where: {
          role: 'AR',
          seksiId: kepalaSeksi.seksiId
        }
      }),

      // Total consultations this month
      prisma.consultation.count({
        where: {
          startTime: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1)
          },
          ar: {
            role: 'AR',
            seksiId: kepalaSeksi.seksiId
          }
        }
      }),

      // Average consultation time (in minutes) - calculate from startTime and endTime
      prisma.consultation.findMany({
        where: {
          status: 'DONE',
          endTime: {
            not: null
          },
          ar: {
            role: 'AR',
            seksiId: kepalaSeksi.seksiId
          }
        },
        select: {
          startTime: true,
          endTime: true
        }
      })
    ])

    const stats = {
      activeConsultations,
      completedToday,
      waitingTaxpayers,
      totalARs,
      totalConsultations,
      avgConsultationTime: avgConsultationTime.length > 0
        ? Math.round(avgConsultationTime.reduce((sum, consultation) => {
            const duration = consultation.endTime && consultation.startTime
              ? (consultation.endTime.getTime() - consultation.startTime.getTime()) / (1000 * 60)
              : 0
            return sum + duration
          }, 0) / avgConsultationTime.length)
        : 0
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching kepala seksi stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}