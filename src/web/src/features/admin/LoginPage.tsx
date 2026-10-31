import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ApiError } from '@/lib/api/client'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, meQuery, safeNext, type AdminUser } from './adminApi'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const me = useQuery(meQuery)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean }>({})
  useDocumentTitle(t('admin.login.title'))

  const login = useMutation({
    mutationFn: () => adminRequest<AdminUser>('POST', '/api/admin/auth/login', { email: email.trim(), password }),
    onSuccess: (user) => {
      queryClient.removeQueries({ queryKey: adminKeys.all })
      queryClient.setQueryData(adminKeys.me, user)
      navigate(next, { replace: true })
    },
  })

  if (me.isSuccess) return <Navigate replace to={next} />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors = { email: !email.trim(), password: !password }
    setFieldErrors(errors)
    if (!errors.email && !errors.password) login.mutate()
  }

  const error =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? t('admin.login.failed')
        : login.error.status === 429
          ? t('admin.login.rateLimited')
          : t('admin.login.error')
      : login.error
        ? t('admin.login.error')
        : null

  const fieldClass =
    'mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 aria-invalid:border-red-400'

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form className="w-full max-w-sm rounded-[2rem] bg-white p-7 shadow-xl" noValidate onSubmit={submit}>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-orange-600 text-white">
          <Icon className="size-6" name="shield" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-black">{t('admin.login.title')}</h1>
        <p className="mt-1 text-center text-sm text-stone-500">{t('admin.login.subtitle')}</p>

        <div className="mt-6">
          <label className="text-sm font-bold" htmlFor="admin-email">
            {t('admin.login.email')}
          </label>
          <input
            aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
            aria-invalid={fieldErrors.email || undefined}
            autoComplete="username"
            className={fieldClass}
            dir="ltr"
            id="admin-email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs font-bold text-red-600" id="admin-email-error">
              {t('admin.login.required')}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm font-bold" htmlFor="admin-password">
            {t('admin.login.password')}
          </label>
          <input
            aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
            aria-invalid={fieldErrors.password || undefined}
            autoComplete="current-password"
            className={fieldClass}
            dir="ltr"
            id="admin-password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs font-bold text-red-600" id="admin-password-error">
              {t('admin.login.required')}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
            {error}
          </p>
        )}

        <Button className="mt-6 w-full" disabled={login.isPending} type="submit">
          {login.isPending ? t('admin.login.submitting') : t('admin.login.submit')}
        </Button>
      </form>
    </main>
  )
}
