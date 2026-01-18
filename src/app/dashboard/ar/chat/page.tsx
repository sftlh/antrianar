'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface User {
  id: number
  nip: string
  role: string
  name: string
}

interface ChatUser {
  id: number
  name: string
  role: string
  nip: string
  isOnline?: boolean
}

interface Chat {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  participants: ChatUser[]
  lastMessage?: {
    content: string
    sentAt: string
    sender: ChatUser
  }
}

interface Message {
  id: number
  chatId: number
  type: string
  content: string
  sentAt: string
  sender: ChatUser
  isMine: boolean
  status?: 'sending' | 'sent' | 'delivered' | 'read'
  replyTo?: {
    id: number
    content: string
    sender: ChatUser
  }
}

export default function ARChatPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])
  const [availableUsers, setAvailableUsers] = useState<ChatUser[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typingUsers, setTypingUsers] = useState<{[chatId: number]: ChatUser[]}>({})
  const [messageStatuses, setMessageStatuses] = useState<{[messageId: number]: 'sent' | 'delivered' | 'read'}>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set())
  const [unreadCounts, setUnreadCounts] = useState<{[chatId: number]: number}>({})
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const { socket, isConnected, joinUser, setUserOnline } = useWebSocket()

  // Sync unread counts from localStorage on mount
  useEffect(() => {
    const unreadCountsLS = JSON.parse(localStorage.getItem('unreadChatCounts') || '{}')
    setUnreadCounts(unreadCountsLS)
  }, [])

  // Join user room and set online when socket connects
  useEffect(() => {
    if (user && isConnected) {
      console.log('Joining user room for chat:', user.id)
      joinUser(user.id)
      // Set user online when entering chat page
      setUserOnline(user.id, true)
      console.log('Set user online for chat page:', user.id)
    }
  }, [user, isConnected, joinUser, setUserOnline])

  // Handle page unload - set offline
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        setUserOnline(user.id, false)
        console.log('Set user offline when leaving chat page:', user.id)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Also set offline when component unmounts
      if (user) {
        setUserOnline(user.id, false)
        console.log('Set user offline on chat page unmount:', user.id)
      }
    }
  }, [user, setUserOnline])

  // Socket event listeners for chat functionality
  useEffect(() => {
    if (!socket || !user || !isConnected) return

    console.log('Setting up chat socket listeners for user:', user.id)

    const handleIncomingMessage = (message: Message) => {
      console.log('Received message via socket:', message)
      const messageWithIsMine = { ...message, isMine: message.sender.id === user?.id }

      if (selectedChat && message.chatId === selectedChat.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev
          return [...prev, messageWithIsMine]
        })

        // Mark message as read if chat is active
        socket.emit('message-read', {
          messageId: message.id,
          chatId: message.chatId,
          userId: user.id
        })
      } else {
        // Increment unread count for chats that are not currently selected
        setUnreadCounts(prev => ({
          ...prev,
          [message.chatId]: (prev[message.chatId] || 0) + 1
        }))

        // Also update localStorage unread counts
        const unreadCountsLS = JSON.parse(localStorage.getItem('unreadChatCounts') || '{}') as Record<string, number>
        unreadCountsLS[message.chatId] = (unreadCountsLS[message.chatId] || 0) + 1
        localStorage.setItem('unreadChatCounts', JSON.stringify(unreadCountsLS))
        
        // Update total unread count in localStorage
        const totalUnread = Object.values(unreadCountsLS).reduce((sum: number, count: number) => sum + count, 0)
        localStorage.setItem('totalUnreadChatCount', totalUnread.toString())
        
        // Trigger storage event for other tabs
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'totalUnreadChatCount',
          newValue: totalUnread.toString()
        }))
      }

      // Update chat's last message
      setChats(prev => prev.map(chat =>
        chat.id === message.chatId
          ? {
              ...chat,
              lastMessage: {
                content: message.content,
                sentAt: message.sentAt,
                sender: message.sender
              },
              updatedAt: message.sentAt
            }
          : chat
      ))
    }

    const handleMessageStatus = (data: { messageId: number, status: 'delivered' | 'read', userId: number }) => {
      setMessageStatuses(prev => ({
        ...prev,
        [data.messageId]: data.status
      }))

      // Update message status in messages array
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, status: data.status }
          : msg
      ))
    }

    const handleTyping = (data: { chatId: number, user: ChatUser, isTyping: boolean }) => {
      setTypingUsers(prev => {
        const chatTyping = prev[data.chatId] || []
        if (data.isTyping) {
          // Add user to typing list if not already there
          if (!chatTyping.some(u => u.id === data.user.id)) {
            return { ...prev, [data.chatId]: [...chatTyping, data.user] }
          }
        } else {
          // Remove user from typing list
          return { ...prev, [data.chatId]: chatTyping.filter(u => u.id !== data.user.id) }
        }
        return prev
      })
    }

    const handleOnlineStatus = (data: { userId: number, isOnline: boolean }) => {
      console.log('📡 Received user-online event:', data)

      setOnlineUsers(prev => {
        const newSet = new Set(prev)
        if (data.isOnline) {
          newSet.add(data.userId)
          console.log(`✅ User ${data.userId} is now online`)
        } else {
          newSet.delete(data.userId)
          console.log(`❌ User ${data.userId} is now offline`)
        }
        console.log('📋 Updated onlineUsers:', Array.from(newSet))
        return newSet
      })

      // Update user online status in available users
      setAvailableUsers(prev => {
        const updated = prev.map(u =>
          u.id === data.userId ? { ...u, isOnline: data.isOnline } : u
        )
        console.log('👥 Updated availableUsers with online status:', updated.filter(u => u.isOnline).length, 'online users')
        return updated
      })

      // Update online status in chat participants
      setChats(prev => prev.map(chat => ({
        ...chat,
        participants: chat.participants.map(p =>
          p.id === data.userId ? { ...p, isOnline: data.isOnline } : p
        )
      })))
    }

    const handleNewChat = (chat: Chat) => {
      const isParticipant = chat.participants.some(p => p.id === user?.id)

      if (isParticipant) {
        setChats(prev => {
          if (prev.some(c => c.id === chat.id)) return prev
          return [chat, ...prev]
        })

        socket.emit('join-chat', { chatId: chat.id })
      }
    }

    // Set up event listeners
    socket.on('message', handleIncomingMessage)
    socket.on('message-status', handleMessageStatus)
    socket.on('user-typing', handleTyping)
    socket.on('user-online', handleOnlineStatus)
    socket.on('chat-created', handleNewChat)

    // Join existing chat rooms
    chats.forEach((chat: Chat) => {
      socket.emit('join-chat', { chatId: chat.id })
    })

    return () => {
      // Clean up event listeners
      socket.off('message', handleIncomingMessage)
      socket.off('message-status', handleMessageStatus)
      socket.off('user-typing', handleTyping)
      socket.off('user-online', handleOnlineStatus)
      socket.off('chat-created', handleNewChat)
    }
  }, [socket, user, isConnected, selectedChat, chats])

  // Update total unread count whenever unreadCounts changes
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
    setTotalUnreadCount(total)
  }, [unreadCounts])

  // Sync total unread count to localStorage for dashboard
  useEffect(() => {
    localStorage.setItem('totalUnreadChatCount', totalUnreadCount.toString())
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'totalUnreadChatCount',
      newValue: totalUnreadCount.toString()
    }))
  }, [totalUnreadCount])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        if (response.ok) {
          const userData = await response.json()
          console.log('Current user data:', userData)
          console.log('User ID:', userData.user?.id)
          setUser(userData.user)
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [router])

  // Fetch chats
  useEffect(() => {
    if (user) {
      console.log('Current user:', user)
      fetchChats()
      fetchAvailableUsers()
    } else {
      // If no authenticated user, still try to fetch users (for testing)
      console.log('No authenticated user, fetching users anyway')
      fetchAvailableUsers()
    }
  }, [user])

  // Add current user to available users if not already present
  useEffect(() => {
    if (user && availableUsers.length > 0) {
      const userExists = availableUsers.some(u => u.id === user.id)
      if (!userExists) {
        console.log('Adding current user to available users')
        setAvailableUsers(prev => [...prev, {
          id: user.id,
          name: user.name,
          role: user.role,
          nip: user.nip,
          isOnline: onlineUsers.has(user.id)
        }])
      }
    }
  }, [user, availableUsers, onlineUsers])

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chat', {
        credentials: 'include'
      })
      if (response.ok) {
        const chatsData = await response.json()
        setChats(chatsData.chats || [])
      } else {
        console.log('Failed to fetch chats, might be unauthenticated')
        setChats([])
      }
    } catch (error) {
      console.error('Error fetching chats:', error)
      setChats([])
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      console.log('Fetching available users...')
      const response = await fetch('/api/chat/users', {
        credentials: 'include'
      })
      console.log('Response status:', response.status)
      if (response.ok) {
        const usersData = await response.json()
        console.log('Available users response:', usersData)
        const users = usersData.users || []
        setAvailableUsers(users)

        // Set online status based on API response (lastCheckedAt within 5 minutes)
        const onlineUserIds = users.filter((u: ChatUser) => u.isOnline).map((u: ChatUser) => u.id)
        setOnlineUsers(prev => {
          const newSet = new Set(prev)
          // Clear existing online status
          newSet.clear()
          // Set only users that are actually online according to API
          onlineUserIds.forEach((id: number) => newSet.add(id))
          console.log('Set users as online based on API response:', onlineUserIds)
          return newSet
        })
      } else {
        console.error('Failed to fetch users:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('Error response:', errorText)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }





  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat)
    localStorage.setItem('lastSelectedChat', chat.id.toString())

    // Reset unread count for this chat
    setUnreadCounts(prev => ({
      ...prev,
      [chat.id]: 0
    }))

    // Reset unread count for this chat in localStorage
    const unreadCountsLS = JSON.parse(localStorage.getItem('unreadChatCounts') || '{}') as Record<string, number>
    unreadCountsLS[chat.id] = 0
    localStorage.setItem('unreadChatCounts', JSON.stringify(unreadCountsLS))
    
    // Update total unread count in localStorage
    const totalUnread = Object.values(unreadCountsLS).reduce((sum: number, count: number) => sum + count, 0)
    localStorage.setItem('totalUnreadChatCount', totalUnread.toString())
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'totalUnreadChatCount',
      newValue: totalUnread.toString()
    }))

    fetchMessages(chat.id)
  }

  const fetchMessages = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        const messagesWithIsMine = data.chat.messages.map((msg: Message) => ({
          ...msg,
          isMine: msg.sender.id === user?.id
        }))
        setMessages(messagesWithIsMine)
        
        // Mark unread messages as read when opening chat
        messagesWithIsMine.forEach((message: Message) => {
          if (!message.isMine && message.status !== 'read') {
            socket?.emit('message-read', {
              messageId: message.id,
              chatId: chatId,
              userId: user?.id
            })
          }
        })
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleUserSelect = async (selectedUser: ChatUser) => {
    if (!user) return

    // Check if there's already a chat with this user
    const existingChat = getExistingChatWithUser(selectedUser.id)
    
    if (existingChat) {
      // Open existing chat
      handleChatSelect(existingChat)
    } else {
      // Create new chat with this user
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            name: `Chat with ${selectedUser.name}`,
            participantIds: [user.id, selectedUser.id]
          })
        })

        if (response.ok) {
          const data = await response.json()
          setChats(prev => [data.chat, ...prev])
          
          // Select the new chat
          handleChatSelect(data.chat)
        }
      } catch (error) {
        console.error('Error creating chat:', error)
      }
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user || !socket) return

    const messageContent = newMessage.trim()
    setNewMessage('')

    // Stop typing indicator
    socket.emit('stop-typing', { chatId: selectedChat.id, userId: user.id })

    // Optimistically add the message to the UI
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      chatId: selectedChat.id,
      type: 'TEXT',
      content: messageContent,
      sentAt: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.name,
        role: user.role,
        nip: user.nip
      },
      isMine: true,
      status: 'sending'
    }

    setMessages(prev => [...prev, optimisticMessage])

    // Update the chat's last message in the sidebar
    setChats(prev => prev.map(chat =>
      chat.id === selectedChat.id
        ? {
            ...chat,
            lastMessage: {
              content: messageContent,
              sentAt: optimisticMessage.sentAt,
              sender: optimisticMessage.sender
            },
            updatedAt: optimisticMessage.sentAt
          }
        : chat
    ))

    try {
      const response = await fetch(`/api/chat/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content: messageContent })
      })

      if (response.ok) {
        const data = await response.json()
        const realMessage = { ...data.message, chatId: selectedChat.id, status: 'sent' as const }

        // Replace the optimistic message with the real one
        setMessages(prev => prev.map(msg =>
          msg.id === optimisticMessage.id ? realMessage : msg
        ))

        // Emit message to other participants
        socket.emit('chat-message', {
          chatId: selectedChat.id,
          message: realMessage,
          participants: selectedChat.participants
        })

        // Update message status to sent
        setMessageStatuses(prev => ({
          ...prev,
          [realMessage.id]: 'sent'
        }))

        // Emit message sent status
        socket.emit('message-sent', {
          messageId: realMessage.id,
          chatId: selectedChat.id,
          participants: selectedChat.participants.filter(p => p.id !== user.id)
        })
      } else {
        // Remove the optimistic message if the request failed
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        setNewMessage(messageContent) // Restore the message
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove the optimistic message if there was an error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      setNewMessage(messageContent) // Restore the message
    }
  }



  const renderMessageStatus = (message: Message) => {
    if (!message.isMine) return null

    const status = message.status || messageStatuses[message.id] || 'sending'

    return (
      <div className="flex items-center justify-end mt-1">
        <span className="text-[10px] text-indigo-200 mr-1">
          {formatTime(message.sentAt)}
        </span>
        {status === 'sending' && (
          <div className="w-3 h-3 border border-indigo-200 border-t-transparent rounded-full animate-spin"></div>
        )}
        {status === 'sent' && (
          <svg className="w-3 h-3 text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'delivered' && (
          <svg className="w-3 h-3 text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 011.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M20.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L12 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'read' && (
          <svg className="w-3 h-3 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 011.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M20.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L12 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    )
  }



  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    } else if (selectedChat && socket && user) {
      // Start typing indicator
      socket.emit('start-typing', { chatId: selectedChat.id, userId: user.id })

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop-typing', { chatId: selectedChat.id, userId: user.id })
      }, 1000)
    }
  }

  const getExistingChatWithUser = (userId: number) => {
    return chats.find(chat => 
      chat.participants.length === 2 && 
      chat.participants.some(p => p.id === userId) &&
      chat.participants.some(p => p.id === user?.id)
    )
  }

  const filteredUsers = availableUsers.filter(u => {
    const isNotSelf = u.id !== user?.id
    const isOnline = onlineUsers.has(u.id)
    const isNotKepalaKantor = u.role !== 'kepala_kantor'
    const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (u.nip?.toLowerCase() || '').includes(searchTerm.toLowerCase())

    const shouldShow = isNotSelf && isOnline && isNotKepalaKantor && matchesSearch

    if (shouldShow) {
      console.log('✅ User will be shown:', {
        id: u.id,
        name: u.name,
        role: u.role,
        isOnline,
        matchesSearch
      })
    }

    return shouldShow
  })

  // Helper function to get unread count for a user
  const getUnreadCountForUser = (userId: number) => {
    // Find chat with this user
    const chat = chats.find(c =>
      c.participants.length === 2 &&
      c.participants.some(p => p.id === userId) &&
      c.participants.some(p => p.id === user?.id)
    )
    return chat ? unreadCounts[chat.id] || 0 : 0
  }

  console.log('📊 Total filtered users:', filteredUsers.length, 'from', availableUsers.length, 'available users')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 z-30 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/ar')}
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                title="Kembali ke Dashboard"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg shadow-md shadow-indigo-500/20 flex items-center justify-center text-white font-bold relative">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {totalUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-800">Live Chat</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role === 'ar' ? 'Account Representative' : user.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm ring-2 ring-white shadow-sm">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full">
        {/* Sidebar */}
        <div className="w-80 md:w-96 flex-none bg-white border-r border-slate-200 flex flex-col z-20">
          <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-xl">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau NIP..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
              />
              <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-slate-900">Tidak ada pengguna online</p>
                <p className="text-xs text-slate-500 mt-1">Pengguna lain sedang offline</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredUsers.map((user) => {
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="p-3 rounded-xl cursor-pointer transition-all group hover:bg-slate-50 relative"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {(user.name?.charAt(0) || 'U').toUpperCase()}
                              </div>
                              {user.isOnline && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className="font-semibold truncate text-slate-800">
                                        {user.name || 'Unknown User'}
                                    </h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full text-xs font-medium ${
                                      onlineUsers.has(user.id)
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {onlineUsers.has(user.id) ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">
                                  {user.role || 'Unknown'} • {user.nip || 'N/A'}
                                </p>
                            </div>
                        </div>
                        {getUnreadCountForUser(user.id) > 0 && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {getUnreadCountForUser(user.id) > 99 ? '99+' : getUnreadCountForUser(user.id)}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 flex-none bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                    {(() => {
                        const otherParticipants = selectedChat.participants.filter(p => p.id !== user.id)
                        return otherParticipants.length > 0 && otherParticipants[0]?.name 
                            ? otherParticipants[0].name.charAt(0).toUpperCase() 
                            : (selectedChat.name?.charAt(0).toUpperCase() || 'C')
                    })()}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 leading-tight">{selectedChat.name}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {(() => {
                        const otherParticipants = selectedChat.participants.filter(p => p.id !== user?.id)
                        if (otherParticipants.length === 1) {
                          const participant = otherParticipants[0]
                          return onlineUsers.has(participant.id) ? 'Online' : 'Offline'
                        }
                        return `${selectedChat.participants.length} peserta`
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {selectedChat.participants.slice(0, 4).map((participant) => (
                    <div
                      key={participant.id}
                      className="w-8 h-8 rounded-full bg-white ring-2 ring-white flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200"
                      title={participant.name}
                    >
                      {participant.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  ))}
                  {selectedChat.participants.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-slate-500 border border-slate-200">
                      +{selectedChat.participants.length - 4}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 scrollbar-thin scrollbar-thumb-slate-200">
                <div className="space-y-6">
                    {messages.map((message, index) => {
                        const isFirstInSequence = index === 0 || messages[index - 1].sender.id !== message.sender.id;
                        const isLastInSequence = index === messages.length - 1 || messages[index + 1].sender.id !== message.sender.id;

                        return (
                            <div
                              key={message.id}
                              className={`flex w-full ${message.isMine ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`flex max-w-[85%] sm:max-w-[70%] ${message.isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                                {!message.isMine && (
                                     <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                                         isLastInSequence ? 'bg-indigo-100 text-indigo-600' : 'opacity-0'
                                     }`}>
                                         {message.sender.name?.charAt(0).toUpperCase() || 'U'}
                                     </div>
                                )}

                                <div className={`relative px-4 py-2 shadow-sm break-words
                                    ${message.isMine
                                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                                    }
                                    ${!isLastInSequence && message.isMine ? 'rounded-br-sm' : ''}
                                    ${!isLastInSequence && !message.isMine ? 'rounded-bl-sm' : ''}
                                `}>
                                    {!message.isMine && isFirstInSequence && (
                                        <p className="text-[10px] font-bold text-indigo-600 mb-0.5 opacity-80">
                                            {message.sender.name}
                                        </p>
                                    )}
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                    {message.isMine ? (
                                      renderMessageStatus(message)
                                    ) : (
                                      <p className="text-[10px] mt-1 text-slate-400">
                                        {formatTime(message.sentAt)}
                                      </p>
                                    )}
                                </div>
                              </div>
                            </div>
                        );
                    })}

                    {/* Typing Indicator */}
                    {selectedChat && typingUsers[selectedChat.id] && typingUsers[selectedChat.id].length > 0 && (
                      <div className="flex w-full justify-start">
                        <div className="flex max-w-[85%] sm:max-w-[70%] items-end gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                            {typingUsers[selectedChat.id][0].name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
                            <div className="flex items-center gap-1">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}></div>
                              </div>
                              <span className="text-xs text-slate-500 ml-2">
                                {typingUsers[selectedChat.id].length === 1
                                  ? `${typingUsers[selectedChat.id][0].name} sedang mengetik...`
                                  : `${typingUsers[selectedChat.id].length} orang sedang mengetik...`
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ketik pesan anda..."
                    className="flex-1 bg-transparent border-none text-sm text-slate-800 focus:ring-0 placeholder:text-slate-400 py-2.5 px-2 max-h-32"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
               <div className="w-24 h-24 bg-white rounded-full shadow-lg shadow-indigo-100 flex items-center justify-center mb-6 animate-bounce-slow">
                     <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                     </svg>
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-2">Selamat Datang di Live Chat</h3>
               <p className="text-slate-500 max-w-sm mb-8">Fitur real-time messaging seperti WhatsApp dengan status pesan, typing indicators, dan online status.</p>
            </div>
          )}
        </div>
      </main>


    </div>
  )
}