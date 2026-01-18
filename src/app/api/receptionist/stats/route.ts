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

    if (decoded.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Fetch statistics for receptionist
    const [
      completedToday,
      activeConsultations,
      availableARs,
      totalARs
    ] = await Promise.all([
      // Completed consultations today
      prisma.consultation.count({
        where: {
          status: 'DONE',
          endTime: {
            gte: today,
            lt: tomorrow
          }
        }
      }),

      // Active consultations (WAITING + IN_CONSULTATION)
      prisma.consultation.count({
        where: {
          status: {
            in: ['WAITING', 'IN_CONSULTATION']
          }
        }
      }),

      // Available ARs - count ARs that are not assigned to active consultations
      prisma.user.count({
        where: {
          role: 'AR',
          AND: [
            {
              consultations: {
                none: {
                  status: {
                    in: ['WAITING', 'IN_CONSULTATION']
                  }
                }
              }
            }
          ]
        }
      }),

      // Total ARs
      prisma.user.count({
        where: {
          role: 'AR'
        }
      })
    ])

    const stats = {
      totalConsultations: activeConsultations + completedToday,
      completedToday,
      activeConsultations,
      availableARs
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching receptionist stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}