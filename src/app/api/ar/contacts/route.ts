
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

    if (decoded.user.role !== 'AR') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // First fetch taxpayers assigned to this AR
    const assignedTaxpayers = await prisma.taxpayer.findMany({
      where: {
        assignedArNip: decoded.user.nip,
      },
      select: {
        id: true,
        name: true,
        npwp: true,
        contacts: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Also fetch taxpayers who currently have an active consultation with this AR, 
    // even if they are not permanently assigned (for completeness)
    const activeConsultationTaxpayers = await prisma.consultation.findMany({
      where: {
        arNip: decoded.user.nip,
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        },
        taxpayer: {
          assignedArNip: {
            not: decoded.user.nip 
          }
        }
      },
      select: {
        taxpayer: {
          select: {
            id: true,
            name: true,
            npwp: true,
            contacts: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        }
      }
    })

    // Merge and deduplicate (though the query prevents overlap on ID)
    const combinedTaxpayers = [
      ...assignedTaxpayers,
      ...activeConsultationTaxpayers.map(c => c.taxpayer)
    ]
    
    // Deduplicate just in case (e.g. if logic above changes)
    const uniqueTaxpayersMap = new Map()
    combinedTaxpayers.forEach(tp => {
      if (!uniqueTaxpayersMap.has(tp.id)) {
        uniqueTaxpayersMap.set(tp.id, tp)
      }
    })

    return NextResponse.json({ 
      taxpayers: Array.from(uniqueTaxpayersMap.values()) 
    })

  } catch (error) {
    console.error('Error fetching AR contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
