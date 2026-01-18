import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const seksiId = parseInt(id)
    if (isNaN(seksiId)) {
      return NextResponse.json({ error: 'ID seksi tidak valid' }, { status: 400 })
    }

    const seksi = await prisma.seksi.findUnique({
      where: { id: seksiId },
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
      }
    })

    if (!seksi) {
      return NextResponse.json({ error: 'Seksi tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ seksi })
  } catch (error) {
    console.error('Error fetching seksi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const seksiId = parseInt(id)
    if (isNaN(seksiId)) {
      return NextResponse.json({ error: 'ID seksi tidak valid' }, { status: 400 })
    }

    const { name, description, isActive } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nama seksi harus diisi' }, { status: 400 })
    }

    // Check if another seksi with the same name exists (excluding current seksi)
    const existingSeksi = await prisma.seksi.findFirst({
      where: {
        name: name.trim(),
        id: { not: seksiId }
      }
    })

    if (existingSeksi) {
      return NextResponse.json({ error: 'Nama seksi sudah ada' }, { status: 400 })
    }

    const seksi = await prisma.seksi.update({
      where: { id: seksiId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json({ seksi })
  } catch (error) {
    console.error('Error updating seksi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const seksiId = parseInt(id)
    if (isNaN(seksiId)) {
      return NextResponse.json({ error: 'ID seksi tidak valid' }, { status: 400 })
    }

    // Check if seksi has users
    const seksi = await prisma.seksi.findUnique({
      where: { id: seksiId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!seksi) {
      return NextResponse.json({ error: 'Seksi tidak ditemukan' }, { status: 404 })
    }

    if (seksi._count.users > 0) {
      return NextResponse.json({
        error: 'Tidak dapat menghapus seksi yang masih memiliki pengguna'
      }, { status: 400 })
    }

    await prisma.seksi.delete({
      where: { id: seksiId }
    })

    return NextResponse.json({ message: 'Seksi berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting seksi:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}