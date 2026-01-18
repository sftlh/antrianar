import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const npwp = searchParams.get('npwp')

    if (!npwp) {
      return NextResponse.json({ error: 'NPWP is required' }, { status: 400 })
    }

    const taxpayer = await prisma.taxpayer.findUnique({
      where: { npwp },
      select: {
        id: true,
        npwp: true,
        name: true,
        createdAt: true,
        consultations: {
          where: {
            status: {
              in: ['WAITING', 'IN_CONSULTATION']
            }
          },
          include: {
            ar: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
    })

    if (!taxpayer) {
      return NextResponse.json({ error: 'Taxpayer not found' }, { status: 404 })
    }

    // Transform the response to include active consultation info
    const response = {
      taxpayer: {
        id: taxpayer.id,
        npwp: taxpayer.npwp,
        name: taxpayer.name,
        createdAt: taxpayer.createdAt,
        activeConsultation: taxpayer.consultations[0] || null
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error looking up taxpayer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}