'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinARRoom: (arNip: string) => void
  leaveARRoom: () => void
  joinUser: (userId: number) => void
  joinKepalaKantorRoom: () => void
  joinAdminRoom: () => void
  setUserOnline: (userId: number, isOnline: boolean) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Initialize socket connection
    const initSocket = () => {
      const newSocket = io('/', {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        upgrade: true,
      })

      newSocket.on('connect', () => {
        console.log('✅ WebSocket connected successfully, socket ID:', newSocket.id)
        setIsConnected(true)
      })

      newSocket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected')
        setIsConnected(false)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error)
        setIsConnected(false)
      })

      socketRef.current = newSocket
      setSocket(newSocket)
    }

    initSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const joinARRoom = (arNip: string) => {
    if (socket && isConnected) {
      console.log('Joining AR room:', arNip)
      socket.emit('join-ar-room', arNip)
    } else {
      console.warn('Cannot join AR room - socket not connected')
    }
  }

  const leaveARRoom = () => {
    if (socket && isConnected) {
      console.log('Leaving AR room')
      socket.emit('leave-ar-room')
    } else {
      console.warn('Cannot leave AR room - socket not connected')
    }
  }

  const joinUser = (userId: number) => {
    if (socket && isConnected) {
      console.log('Joining user room:', userId)
      socket.emit('join', { userId })
    } else {
      console.warn('Cannot join user room - socket not connected')
    }
  }

  const joinKepalaKantorRoom = () => {
    if (socket && isConnected) {
      console.log('🚀 Joining Kepala Kantor room...')
      socket.emit('join-kepala-kantor-room')
      console.log('📤 Emitted join-kepala-kantor-room event')
    } else {
      console.warn('⚠️ Cannot join Kepala Kantor room - socket not connected', {
        socket: !!socket,
        isConnected
      })
    }
  }

  const joinAdminRoom = () => {
    if (socket && isConnected) {
      console.log('🚀 Joining Admin room...')
      socket.emit('join-admin-room')
      console.log('📤 Emitted join-admin-room event')
    } else {
      console.warn('⚠️ Cannot join Admin room - socket not connected', {
        socket: !!socket,
        isConnected
      })
    }
  }

  const setUserOnline = (userId: number, isOnline: boolean) => {
    if (socket && isConnected) {
      console.log('Setting user online status:', userId, isOnline)
      socket.emit('user-online', { userId, isOnline })
    } else {
      console.warn('Cannot set user online status - socket not connected')
    }
  }

  return (
    <WebSocketContext.Provider value={{
      socket,
      isConnected,
      joinARRoom,
      leaveARRoom,
      joinUser,
      joinKepalaKantorRoom,
      joinAdminRoom,
      setUserOnline
    }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}