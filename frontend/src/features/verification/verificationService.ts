import api from '@/lib/axios'
import type {
  ApiResponse,
  DocumentStatus,
  Paginated,
  User,
  VerificationDetail,
  VerificationDocument,
  VerificationMeta,
  VerificationProgress,
  VerificationStatus,
  VerificationSubject,
} from '@/types'

export interface ListReviewParams {
  limit?: number
  offset?: number
  role?: string // comma-separated
  status?: VerificationStatus
  search?: string
}

export const verificationApi = {
  getMeta: async (): Promise<VerificationMeta> => {
    const res = await api.get<ApiResponse<VerificationMeta>>('/verification/meta')
    return res.data.data
  },

  getMyDocuments: async (): Promise<VerificationDocument[]> => {
    const res = await api.get<ApiResponse<VerificationDocument[]>>('/verification/documents/me')
    return res.data.data
  },

  getMyProgress: async (): Promise<VerificationProgress> => {
    const res = await api.get<ApiResponse<VerificationProgress>>('/verification/me/progress')
    return res.data.data
  },

  upload: async (docType: string, file: File): Promise<VerificationDocument> => {
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    const res = await api.post<ApiResponse<VerificationDocument>>(
      '/verification/documents',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data.data
  },

  /** Authenticated download/preview URL for a document. */
  fileUrl: (documentId: number): string =>
    `${api.defaults.baseURL}/verification/documents/${documentId}/file`,

  // ── Moderator ──────────────────────────────────────────────────
  listForReview: async (params: ListReviewParams = {}): Promise<Paginated<VerificationSubject>> => {
    const res = await api.get<ApiResponse<Paginated<VerificationSubject>>>('/verification/review', {
      params,
    })
    return res.data.data
  },

  getUserDetail: async (userId: number): Promise<VerificationDetail> => {
    const res = await api.get<ApiResponse<VerificationDetail>>(`/verification/review/${userId}`)
    return res.data.data
  },

  reviewDocument: async (
    documentId: number,
    payload: { to_status: DocumentStatus; note?: string }
  ): Promise<VerificationDocument> => {
    const res = await api.patch<ApiResponse<VerificationDocument>>(
      `/verification/documents/${documentId}/status`,
      payload
    )
    return res.data.data
  },

  activate: async (userId: number): Promise<User> => {
    const res = await api.post<ApiResponse<User>>(`/verification/users/${userId}/activate`)
    return res.data.data
  },

  suspend: async (userId: number, note?: string): Promise<User> => {
    const res = await api.post<ApiResponse<User>>(`/verification/users/${userId}/suspend`, { note })
    return res.data.data
  },

  reject: async (userId: number, note: string): Promise<User> => {
    const res = await api.post<ApiResponse<User>>(`/verification/users/${userId}/reject`, { note })
    return res.data.data
  },
}
