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

    // Fetch recent consultations (last 10) with taxpayer and AR details
    const consultations = await prisma.consultation.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        taxpayer: {
          select: {
            id: true,
            name: true,
            npwp: true
          }
        },
        ar: {
          select: {
            id: true,
            name: true,
            seksi: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ consultations })
  } catch (error) {
    console.error('Error fetching recent consultations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}