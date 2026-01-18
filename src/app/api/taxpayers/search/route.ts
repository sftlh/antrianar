import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ taxpayers: [] })
    }

    const taxpayers = await prisma.taxpayer.findMany({
      where: {
        OR: [
          {
            npwp: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            name: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        assignedAr: {
          select: {
            name: true,
            nip: true
          }
        },
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
      take: 10, // Limit results to prevent too many options
      orderBy: {
        name: 'asc'
      }
    })

    // Transform the response to include active consultation info
    const transformedTaxpayers = taxpayers.map(taxpayer => ({
      id: taxpayer.id,
      npwp: taxpayer.npwp,
      name: taxpayer.name,
      createdAt: taxpayer.createdAt,
      activeConsultation: taxpayer.consultations.length > 0 ? {
        id: taxpayer.consultations[0].id,
        status: taxpayer.consultations[0].status,
        room: taxpayer.consultations[0].room,
        createdAt: taxpayer.consultations[0].startTime,
        ar: taxpayer.consultations[0].ar ? {
          name: taxpayer.consultations[0].ar.name
        } : undefined
      } : null
    }))

    return NextResponse.json({ taxpayers: transformedTaxpayers })
  } catch (error) {
    console.error('Error searching taxpayers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}