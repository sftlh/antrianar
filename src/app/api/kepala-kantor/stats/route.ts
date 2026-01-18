/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - check header first, then cookie
    let token: string | undefined
    const authHeader = request.headers.get('authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Try to get token from cookie
      token = request.cookies.get('token')?.value
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as any

    if (decoded.user.role !== 'KEPALA_KANTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // -6 to include today as 7th day
    sevenDaysAgo.setHours(0, 0, 0, 0)

    // Fetch all statistics for head office
    const [
      totalConsultations,
      activeConsultations,
      completedToday,
      waitingTaxpayers,
      totalARs,
      activeARs,
      totalSeksi,
      totalUsers,
      seksiData,
      weeklyData
    ] = await Promise.all([
      // Total consultations ever
      prisma.consultation.count(),

      // Active consultations (IN_CONSULTATION)
      prisma.consultation.count({
        where: { status: 'IN_CONSULTATION' }
      }),

      // Completed today
      prisma.consultation.count({
        where: {
          status: 'DONE',
          updatedAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),

      // Waiting taxpayers (taxpayers with WAITING consultations)
      prisma.consultation.count({
        where: { status: 'WAITING' }
      }),

      // Total ARs (users with role AR) - Total semua AR
      prisma.user.count({
        where: { role: 'AR' }
      }),

      // Active ARs (ARs currently in consultation)
      prisma.user.count({
        where: {
          role: 'AR',
          consultations: {
            some: {
              status: 'IN_CONSULTATION'
            }
          }
        }
      }),

      // Total active seksi
      prisma.seksi.count({
        where: { isActive: true }
      }),

      // Total users
      prisma.user.count(),

      // Consultations per Seksi
      prisma.seksi.findMany({
        where: { isActive: true },
        select: {
          name: true,
          users: {
            where: { role: 'AR' },
            select: {
              _count: {
                select: { consultations: true }
              }
            }
          }
        }
      }),

      // Weekly trends
      prisma.consultation.findMany({
        where: {
          createdAt: {
            gte: sevenDaysAgo
          }
        },
        select: {
          createdAt: true
        }
      })
    ])

    // Process Seksi Stats
    const consultationsBySeksi = seksiData.map(seksi => ({
      name: seksi.name,
      count: seksi.users.reduce((acc, user) => acc + user._count.consultations, 0)
    })).sort((a, b) => b.count - a.count)

    // Process Weekly Trends
    const weeklyTrends = new Array(7).fill(0).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toISOString().split('T')[0]
      
      const count = weeklyData.filter(c => {
        const cDate = new Date(c.createdAt)
        return cDate.toISOString().split('T')[0] === dateStr
      }).length
      
      return {
        date: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        fullDate: dateStr,
        count
      }
    })

    const stats = {
      totalConsultations,
      activeConsultations,
      completedToday,
      waitingTaxpayers,
      totalARs,
      activeARs,
      totalSeksi,
      totalUsers,
      consultationsBySeksi,
      weeklyTrends
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching kepala kantor stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}