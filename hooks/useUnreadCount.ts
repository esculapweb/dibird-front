import { useQuery } from '@tanstack/react-query'
import { fetchUnreadCount } from '../util/fetches'

export const UNREAD_COUNT_KEY = ['notifications', 'unread-count']

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: fetchUnreadCount,
    staleTime: 60_000,       // рефетч не чаще раза в минуту
    refetchInterval: 2 * 60_000, // фоновый polling раз в 2 мин
  })
}