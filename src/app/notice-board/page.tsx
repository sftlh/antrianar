'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface WaitingTaxpayer {
  id: number
  npwp: string
  name: string
  consultationId: number
  consultationStatus: string
  room?: string
  assignedAr: {
    id: number
    name: string
    nip: string
  } | null
  createdAt: string
}

export default function NoticeBoardPage() {
  const [waitingTaxpayers, setWaitingTaxpayers] = useState<WaitingTaxpayer[]>([])
  const [currentCallIndex, setCurrentCallIndex] = useState(0)
  const [isCalling, setIsCalling] = useState(false)
  const lastCallTimeRef = useRef<number>(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const CALL_INTERVAL = 30000 // 30 seconds between calls
  const CALL_DURATION = 10000 // 10 seconds per call

  // Calculate waiting duration
  const calculateWaitingDuration = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = currentTime
    const diffMs = now.getTime() - created.getTime()
    
    console.log('Duration calc:', {
      createdAt,
      created: created.toISOString(),
      now: now.toISOString(),
      diffMs,
      createdLocal: created.toLocaleString(),
      nowLocal: now.toLocaleString()
    })
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}j ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  // Get waiting duration color and style based on time
  const getWaitingDurationColor = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = currentTime
    const diffMs = now.getTime() - created.getTime()
    const minutes = diffMs / (1000 * 60)
    
    if (minutes >= 60) return 'text-red-400 font-bold animate-pulse' // More than 1 hour - red with pulse
    if (minutes >= 30) return 'text-yellow-400 font-semibold' // More than 30 min - yellow
    return 'text-green-400' // Less than 30 min - green
  }

  // Get card style based on waiting time
  const getCardStyle = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = currentTime
    const diffMs = now.getTime() - created.getTime()
    const minutes = diffMs / (1000 * 60)
    
    if (minutes >= 60) {
      return 'bg-red-900/20 border-red-500/30 shadow-red-500/20' // Red theme for long wait
    }
    if (minutes >= 30) {
      return 'bg-yellow-900/20 border-yellow-500/30' // Yellow theme for medium wait
    }
    return '' // Default style
  }

  const fetchWaitingTaxpayers = useCallback(async () => {
    try {
      const response = await fetch('/api/taxpayers/waiting-with-ar')
      if (response.ok) {
        const data = await response.json()
        setWaitingTaxpayers(data.taxpayers || [])
      }
    } catch (error) {
      console.error('Error fetching waiting taxpayers:', error)
    }
  }, [])

  const startCallingCycle = () => {
    if (intervalRef.current) return

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      if (waitingTaxpayers.length === 0) {
        setIsCalling(false)
        setCurrentCallIndex(0)
        return
      }
      if (now - lastCallTimeRef.current >= CALL_INTERVAL) {
        lastCallTimeRef.current = now
        callNextTaxpayer()
      }
    }, 1000)
  }

  const stopCallingCycle = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const callNextTaxpayer = () => {
    if (waitingTaxpayers.length === 0) return

    const taxpayer = waitingTaxpayers[currentCallIndex]
    if (taxpayer?.assignedAr) {
      setIsCalling(true)
      speakCall(taxpayer)

      setTimeout(() => {
        setIsCalling(false)
        // Move to next after call finishes
        if (waitingTaxpayers.length > 0) {
           setCurrentCallIndex((prev) => (prev + 1) % waitingTaxpayers.length)
        }
      }, CALL_DURATION)
    } else {
       // Skip if no assigned AR
       if (waitingTaxpayers.length > 0) {
           setCurrentCallIndex((prev) => (prev + 1) % waitingTaxpayers.length)
       }
    }
  }

  const speakCall = (taxpayer: WaitingTaxpayer) => {
    if (!taxpayer.assignedAr) return

    const roomText = taxpayer.room ? `di ${taxpayer.room}` : 'di Ruang Konsultasi';
    const message = `Panggilan kepada Account Representative ${taxpayer.assignedAr.name}, ditunggu ${taxpayer.name} ${roomText}`

    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = 'id-ID'
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1

      // Try to find an Indonesian voice
      const voices = speechSynthesis.getVoices()
      const indonesianVoice = voices.find(v => v.lang.includes('id'))
      if (indonesianVoice) utterance.voice = indonesianVoice

      speechSynthesis.speak(utterance)
      
      // Speak twice for better attention
      const utterance2 = new SpeechSynthesisUtterance(message)
      if (indonesianVoice) utterance2.voice = indonesianVoice
      utterance2.rate = 0.9
      
      // Small pause between repeats handled by queueing
      setTimeout(() => speechSynthesis.speak(utterance2), 4000)
    }
  }

  const getCurrentCall = () => {
    if (!isCalling) return null
    // The current index points to the one being called
    return waitingTaxpayers[currentCallIndex]
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/taxpayers/waiting-with-ar')
        if (response.ok) {
          const data = await response.json()
          setWaitingTaxpayers(data.taxpayers || [])
        }
      } catch (error) {
        console.error('Error fetching waiting taxpayers:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    // Clock timer
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000)
    
    // Refresh data every 10 seconds
    const refreshInterval = setInterval(fetchWaitingTaxpayers, 10000)
    
    return () => {
      clearInterval(clockInterval)
      clearInterval(refreshInterval)
    }
  }, [fetchWaitingTaxpayers])

  useEffect(() => {
    if (waitingTaxpayers.length > 0) {
      startCallingCycle()
    } else {
      stopCallingCycle()
    }

    return () => stopCallingCycle()
  }, [waitingTaxpayers])

  const currentCall = getCurrentCall()

  // Format date: Senin, 14 Januari 2026
  const dateString = currentTime.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })
  
  // Format time: 14:05:22
  const timeString = currentTime.toLocaleTimeString('id-ID', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <div className={`min-h-screen bg-slate-900 text-white overflow-hidden flex flex-col font-sans relative`}>
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700 via-slate-900 to-black opacity-60 z-0"></div>
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0"></div>

      {/* Header */}
      <header className="relative z-10 bg-slate-800/80 backdrop-blur-md border-b border-white/10 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">KPP MADYA DUA SURABAYA</h1>
            <p className="text-blue-300 font-medium tracking-widest text-sm uppercase">Sistem Monitoring Layanan Konsultasi</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-md">
            {timeString}
          </div>
          <div className="text-blue-200 font-medium text-lg uppercase tracking-wide">
            {dateString}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-8 flex gap-8">
        
        {/* Left Panel: Active Call or Hero Status */}
        <div className="flex-1 flex flex-col justify-center">
            {isCalling && currentCall ? (
                <div className="animate-popup flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-12 shadow-[0_0_60px_-15px_rgba(79,70,229,0.5)] border border-white/20 relative overflow-hidden group transition-all">
                    <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400 rounded-full blur-3xl opacity-20"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400 rounded-full blur-3xl opacity-20"></div>
                    
                    <div className="relative z-10 text-center space-y-8">
                        <div className="inline-block px-6 py-2 bg-red-500 text-white font-bold rounded-full animate-bounce shadow-lg uppercase tracking-widest text-sm">
                            Memanggil
                        </div>
                        
                        <div className="space-y-2">
                            <p className="text-blue-200 text-xl uppercase tracking-widest font-semibold">Kepada Account Representative</p>
                            <h2 className="text-5xl md:text-6xl font-black text-white drop-shadow-xl leading-tight">
                                {currentCall.assignedAr?.name}
                            </h2>
                        </div>

                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

                        <div className="space-y-2">
                            <p className="text-blue-200 text-xl uppercase tracking-widest font-semibold">Terdapat Tamu</p>
                            <h3 className="text-4xl md:text-5xl font-bold text-yellow-300 drop-shadow-md">
                                {currentCall.name}
                            </h3>
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <span className="text-2xl">⏱️</span>
                                <span className={`text-2xl font-bold ${getWaitingDurationColor(currentCall.createdAt)}`}>
                                    {calculateWaitingDuration(currentCall.createdAt)}
                                </span>
                            </div>
                        </div>

                        <div className="pt-6">
                             <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-8 py-4 rounded-2xl border border-white/10">
                                <span className="text-3xl">📍</span>
                                <span className="text-2xl md:text-3xl font-bold text-white">
                                    {currentCall.room || 'Ruang Konsultasi'}
                                </span>
                             </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white/5 rounded-3xl border border-white/10 p-12 text-center backdrop-blur-sm shadow-xl">
                   {waitingTaxpayers.length > 0 ? (
                       <>
                        <div className="mb-6 w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
                            <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-4">Standby Monitoring</h2>
                        <p className="text-xl text-blue-200 max-w-md mx-auto">
                            Menampilkan daftar AR yang memiliki tamu menunggu di ruangan konsultasi.
                        </p>
                       </>
                   ) : (
                       <>
                        <div className="mb-6 w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-4">Semua Terlayani</h2>
                        <p className="text-xl text-green-200 max-w-md mx-auto">
                            Saat ini tidak ada antrian konsultasi yang menunggu kehadiran AR.
                        </p>
                       </>
                   )}
                </div>
            )}
        </div>

        {/* Right Panel: Waiting List */}
        <div className="w-1/3 flex flex-col bg-slate-800/50 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="bg-slate-800/80 p-6 border-b border-white/10">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    PERLU KEHADIRAN AR
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {waitingTaxpayers.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 opacity-60">
                         <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-lg font-medium">Data antrian kosong</p>
                     </div>
                ) : (
                    waitingTaxpayers.map((item, idx) => (
                        <div 
                            key={item.id} 
                            className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${getCardStyle(item.createdAt)} ${
                                isCalling && currentCall?.id === item.id 
                                ? 'bg-indigo-600/40 border-indigo-400/50 shadow-lg scale-[1.02]' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10'
                            }`}
                        >
                            {isCalling && currentCall?.id === item.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 animate-pulse"></div>
                            )}
                            
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded bg-white/10 text-white/70 ${isCalling && currentCall?.id === item.id ? 'bg-indigo-500 text-white' : ''}`}>
                                    ANTRIAN #{idx + 1}
                                </span>
                                <div className="text-right">
                                    <div className={`text-xs font-bold flex items-center gap-1 ${getWaitingDurationColor(item.createdAt)}`}>
                                        {(() => {
                                          const created = new Date(item.createdAt)
                                          const now = currentTime
                                          const diffMs = now.getTime() - created.getTime()
                                          const minutes = diffMs / (1000 * 60)
                                          return minutes >= 60 ? '⚠️' : '⏱️'
                                        })()}
                                        {calculateWaitingDuration(item.createdAt)}
                                    </div>
                                    <div className="text-xs text-blue-300 font-mono">
                                        {new Date(item.createdAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3">
                                <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Account Representative</p>
                                <p className="text-lg font-bold text-white truncate">
                                    {item.assignedAr?.name || 'Menunggu Penugasan'}
                                </p>
                            </div>

                            <div className="pt-3 border-t border-white/10">
                                <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Tamu / Wajib Pajak</p>
                                <p className="text-base font-semibold text-yellow-100 truncate">
                                    {item.name}
                                </p>
                            </div>
                            
                            {item.room && (
                                <div className="absolute right-4 bottom-4 opacity-20">
                                   <span className="text-4xl">🏢</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <div className="bg-slate-800/50 p-3 text-center border-t border-white/10 text-xs text-slate-400">
                Total Menunggu: <span className="text-white font-bold">{waitingTaxpayers.length}</span>
            </div>
        </div>
      </main>

      {/* Footer / Running Text */}
      <footer className="relative z-10 bg-blue-900 border-t border-white/10 py-3 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee flex items-center gap-8 text-lg font-medium text-blue-200">
             <span>📢 Mohon kepada Account Representative yang dipanggil untuk segera menuju ruangan konsultasi.</span>
             <span className="mx-4 text-blue-500">•</span>
             <span>Pelayanan Prima, Kepuasan Wajib Pajak Prioritas Kami.</span>
             <span className="mx-4 text-blue-500">•</span>
             <span>Gunakan masker dan patuhi protokol kesehatan di area kantor.</span>
             <span className="mx-4 text-blue-500">•</span>
             <span>Terima kasih atas kerja sama Anda.</span>
        </div>
      </footer>
      
      {/* CSS for simple marquee animation if tailwind plugin not present */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes popup {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-popup {
            animation: popup 0.5s ease-out forwards;
        }
        /* Custom scrollbar for webkit */
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}