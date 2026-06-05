import { useMemo } from 'react'
import { ShieldCheck, Clock, CheckCircle2, FileUp, AlertTriangle } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { useMyProgress, useMyDocuments } from '../hooks/useVerification'
import { DocStatusBadge, VerificationStatusBadge } from '../statusBadge'
import DocumentUploadCard from '../components/DocumentUploadCard'
import { docLabel } from '@/config/verificationDocs'
import { useAuthStore } from '@/store/authStore'

function deadlineNote(deadline?: string | null): string | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'Your verification window has elapsed.'
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return `Complete verification within ${days} day${days === 1 ? '' : 's'}.`
}

export default function VerificationDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: progress, isLoading } = useMyProgress()
  const { data: documents } = useMyDocuments()

  // Activity timeline synthesized from the user's documents.
  const timeline = useMemo(() => {
    const events: { at: string; label: string }[] = []
    for (const d of documents ?? []) {
      events.push({ at: d.uploaded_at, label: `Uploaded ${docLabel(d.doc_type)}` })
      if (d.reviewed_at && (d.status === 'approved' || d.status === 'rejected')) {
        events.push({
          at: d.reviewed_at,
          label: `${docLabel(d.doc_type)} ${d.status === 'approved' ? 'approved' : 'rejected'}`,
        })
      }
    }
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12)
  }, [documents])

  if (isLoading || !progress) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const pct =
    progress.required_total > 0
      ? Math.round((progress.required_approved / progress.required_total) * 100)
      : 100
  const note = deadlineNote(user?.verification_deadline)
  const isActivated = progress.overall_status === 'activated'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header / progress summary */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5">
              <ShieldCheck className="text-indigo-600" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account Verification</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Upload your required documents to unlock full CRM access.
              </p>
              <div className="mt-2">
                <VerificationStatusBadge status={progress.overall_status} />
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold text-gray-900">
              {progress.documents_uploaded_label}
            </p>
            <p className="text-xs text-gray-500">documents uploaded</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>
              {progress.required_approved} of {progress.required_total} required documents approved
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4EAFFF] to-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {isActivated ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} /> Your account is fully verified and active.
          </p>
        ) : note ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <Clock size={16} /> {note}
          </p>
        ) : null}
      </Card>

      {/* Upload cards */}
      <Card>
        <CardHeader
          title="Required Documents"
          description="Accepted formats: PDF, JPG, JPEG, PNG — max 10 MB each."
        />
        {progress.documents.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <FileUp size={16} /> No documents are required for your role.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {progress.documents.map((row) => (
              <DocumentUploadCard key={row.doc_type} row={row} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document status table */}
        <Card>
          <CardHeader title="Document Status" />
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <tr>
                  <th className="px-4 py-2">Document</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {progress.documents.map((row) => (
                  <tr key={row.doc_type}>
                    <td className="px-4 py-2.5 text-gray-700">{row.label}</td>
                    <td className="px-4 py-2.5">
                      <DocStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader title="Activity Timeline" />
          {timeline.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <AlertTriangle size={16} /> No activity yet.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-gray-200 pl-4">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
                  <p className="text-sm text-gray-700">{e.label}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
