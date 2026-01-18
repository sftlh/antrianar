import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get the first available AR (for now, just get any AR)
    // In a real application, you might want to get the AR with the least active consultations
    const ar = await prisma.user.findFirst({
      where: { role: 'AR' },
      select: {
        id: true,
        name: true,
        nip: true,
      },
    })

    if (!ar) {
      return NextResponse.json({ error: 'No AR available' }, { status: 404 })
    }

    return NextResponse.json({ ar })
  } catch (error) {
    console.error('Error getting AR:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}