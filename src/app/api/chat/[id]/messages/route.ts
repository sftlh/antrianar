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
      ? 'http://localhost:3000' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
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

// POST /api/chat/[id]/messages - Send a message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const chatId = parseInt(id)
    if (isNaN(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 })
    }

    // Check if user is a participant in this chat
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId: currentUser.id
      }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { content, type = 'TEXT' } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: currentUser.id,
        type,
        content: content.trim()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    })

    // Update chat's updatedAt timestamp
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    // Format the response
    const formattedMessage = {
      id: message.id,
      type: message.type,
      content: message.content,
      sentAt: message.sentAt,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        role: message.sender.role
      },
      isMine: true
    }

    return NextResponse.json({ message: formattedMessage }, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}