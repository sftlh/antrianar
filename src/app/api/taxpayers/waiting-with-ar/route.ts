import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Only call ARs who haven't checked their dashboard in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const consultations = await prisma.consultation.findMany({
      where: {
        status: 'WAITING',
        taxpayer: {
          assignedArNip: {
            not: null
          },
          // assignedAr: {
          //   lastCheckedAt: {
          //     lt: fiveMinutesAgo // Only ARs who checked more than 5 minutes ago
          //   }
          // }
        }
      },
      include: {
        taxpayer: {
          include: {
            assignedAr: {
              select: {
                id: true,
                name: true,
                nip: true,
                lastCheckedAt: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Oldest first
      },
    })

    // Transform to maintain similar response structure
    const taxpayers = consultations.map(consultation => {
      const result = {
        ...consultation.taxpayer,
        consultationId: consultation.id,
        consultationStatus: consultation.status,
        room: consultation.room,
        createdAt: consultation.createdAt // Use consultation createdAt, not taxpayer createdAt
      }
      
      console.log('API Response Item:', {
        taxpayerId: consultation.taxpayer.id,
        consultationId: consultation.id,
        consultationCreatedAt: consultation.createdAt,
        taxpayerCreatedAt: consultation.taxpayer.createdAt,
        finalCreatedAt: result.createdAt
      })
      
      return result
    })

    console.log('API Response Summary:', {
      totalConsultations: consultations.length,
      sampleCreatedAt: consultations[0]?.createdAt
    })

    return NextResponse.json({ taxpayers })
  } catch (error) {
    console.error('Error fetching waiting taxpayers with AR:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}