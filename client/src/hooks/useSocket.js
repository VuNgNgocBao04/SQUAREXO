import { useEffect, useMemo } from 'react'
import { io } from 'socket.io-client'

export function useSocket(token) {
  const socket = useMemo(
    () =>
      io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000', {
        autoConnect: false,
        auth: token ? { token } : undefined,
      }),
    [token]
  )

  useEffect(() => {
    socket.connect()
    return () => socket.disconnect()
  }, [socket])

  return socket
}
