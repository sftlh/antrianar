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

    if (decoded.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const seksi = await prisma.seksi.findMany({
      include: {
        users: {
          select: {
            id: true,
            nip: true,
            name: true,
            role: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ seksi })
  } catch (error) {
    console.error('Error fetching seksi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    if (decoded.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name, description } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nama seksi harus diisi' }, { status: 400 })
    }

    // Check if seksi name already exists
    const existingSeksi = await prisma.seksi.findUnique({
      where: { name: name.trim() }
    })

    if (existingSeksi) {
      return NextResponse.json({ error: 'Nama seksi sudah ada' }, { status: 400 })
    }

    const seksi = await prisma.seksi.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    return NextResponse.json({ seksi })
  } catch (error) {
    console.error('Error creating seksi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}