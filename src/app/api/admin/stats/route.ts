import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const [taxpayerCount, roomCount, userCount] = await Promise.all([
      prisma.taxpayer.count(),
      prisma.room.count(),
      prisma.user.count()
    ])

    return NextResponse.json({
      taxpayerCount,
      roomCount,
      userCount
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
