import QueryProvider from './providers/QueryProvider'
import AuthProvider from './providers/AuthProvider'
import Router from './Router'

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryProvider>
  )
}
