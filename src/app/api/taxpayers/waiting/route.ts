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

    const waitingConsultations = await prisma.consultation.findMany({
      where: {
        status: 'WAITING',
        taxpayer: {
          assignedArNip: null,
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

    // Transform to maintain the same response structure for now
    const taxpayers = waitingConsultations.map(consultation => ({
      ...consultation.taxpayer,
      consultationId: consultation.id,
      consultationStatus: consultation.status,
    }))

    return NextResponse.json({ taxpayers })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}