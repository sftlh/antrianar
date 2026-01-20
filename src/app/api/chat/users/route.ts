/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to get current user
async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('cookie')
  if (!authHeader || !authHeader.includes('token=')) {
    return null
  }

  try {
    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3001' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3001')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    return meData.user || null
  } catch (error) {
    console.error('Auth check failed:', error)
    return null
  }
}

// GET /api/chat/users - Get available users to chat with
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    console.log('Current user in chat/users API:', currentUser)

    // For testing, if no authenticated user, assume user ID 1 (Ahmad Santoso)
    const userId = currentUser?.id || 1

    // Get all users except kepala kantor, and exclude current user if authenticated
    const whereCondition: any = {
      role: {
        not: 'KEPALA_KANTOR'
      }
    }

    if (userId && userId !== 1) { // Only exclude if we have a real authenticated user (not the default)
      whereCondition.id = {
        not: userId
      }
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        nip: true,
        name: true,
        role: true,
        lastCheckedAt: true
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    }).catch(error => {
      console.error('Database error:', error)
      throw error
    })

    console.log('Users found in database:', users.length)

    // Format users for response
    const formattedUsers = users.map(user => ({
      id: user.id,
      nip: user.nip,
      name: user.name,
      role: user.role,
      isOnline: user.lastCheckedAt && (new Date().getTime() - new Date(user.lastCheckedAt).getTime()) < 2 * 60 * 1000 // Online if checked in last 2 minutes
    }))

    console.log('Formatted users:', formattedUsers)

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}