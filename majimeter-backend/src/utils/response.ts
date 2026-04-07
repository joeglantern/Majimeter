export function ok<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message !== undefined && { message }),
  }
}

export function paginated<T>(
  data: T[],
  meta: { cursor: string | null; limit: number; total?: number },
) {
  return { success: true as const, data, meta }
}
