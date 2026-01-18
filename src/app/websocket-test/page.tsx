'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from '@/contexts/WebSocketContext'

export default function WebSocketTestPage() {
  const { socket, isConnected, joinARRoom, leaveARRoom } = useWebSocket()
  const [arNip, setArNip] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    if (socket) {
      // Listen for test messages
      socket.on('test-message', (data) => {
        setMessages(prev => [...prev, `Received: ${JSON.stringify(data)}`])
      })

      // Listen for taxpayer assignment notifications
      socket.on('new-taxpayer-assigned', (data) => {
        setMessages(prev => [...prev, `Taxpayer assigned: ${data.taxpayerName} (${data.taxpayerNip})`])
      })

      return () => {
        socket.off('test-message')
        socket.off('new-taxpayer-assigned')
      }
    }
  }, [socket])

  const handleJoinRoom = () => {
    if (arNip.trim()) {
      joinARRoom(arNip.trim())
      setMessages(prev => [...prev, `Joined room for AR: ${arNip}`])
    }
  }

  const handleLeaveRoom = () => {
    leaveARRoom()
    setMessages(prev => [...prev, 'Left AR room'])
  }

  const handleSendTestMessage = () => {
    if (socket && testMessage.trim()) {
      socket.emit('test-message', { message: testMessage, timestamp: new Date().toISOString() })
      setMessages(prev => [...prev, `Sent: ${testMessage}`])
      setTestMessage('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">WebSocket Test Page</h1>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-lg">{isConnected ? 'Connected' : 'Disconnected'}</span>
            {socket && <span className="text-sm text-gray-500">Socket ID: {socket.id}</span>}
          </div>
        </div>

        {/* Room Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">AR Room Management</h2>
          <div className="flex space-x-4 mb-4">
            <input
              type="text"
              placeholder="Enter AR NIP"
              value={arNip}
              onChange={(e) => setArNip(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!isConnected || !arNip.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
            <button
              onClick={handleLeaveRoom}
              disabled={!isConnected}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Test Message Sending */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Send Test Message</h2>
          <div className="flex space-x-4">
            <input
              type="text"
              placeholder="Enter test message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendTestMessage()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSendTestMessage}
              disabled={!isConnected || !testMessage.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>

        {/* Messages Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Messages Log</h2>
          <div className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500">No messages yet...</p>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div key={index} className="text-sm font-mono bg-white p-2 rounded border">
                    {message}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setMessages([])}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Clear Log
          </button>
        </div>
      </div>
    </div>
  )
}