import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const AUTH_FREE_PATHS = new Set(['/login', '/register'])

function getBasePath(): string {
  return (import.meta.env.VITE_BASE_PATH as string | undefined) || '/'
}

function isOpLocalEnv(): boolean {
  return (import.meta.env.VITE_PLATFORM as string | undefined) === 'op-local'
}

function isPrivatePremEnv(): boolean {
  return (import.meta.env.VITE_PRIVATE_PREM as string | undefined) === 'true'
}

export function gotoLogin(): void {
  const basePath = getBasePath()

  // React 版阶段 0-1：先保持在应用内部登录页（避免跨应用/SSO 跳转带来的不确定性）
  const loginUrl = `${window.location.origin}${basePath}/#/login`

  // 私有化/本地环境：同样在应用内部完成登录
  if (isOpLocalEnv() || isPrivatePremEnv()) {
    window.location.replace(loginUrl)
    return
  }

  window.location.replace(loginUrl)
}

export function RequireAuth(props: PropsWithChildren) {
  const location = useLocation()

  const isInvalidUser = !localStorage.getItem('access_token')
  const isAuthFree = AUTH_FREE_PATHS.has(location.pathname)

  if (!isAuthFree && isInvalidUser) {
    // 与 Vue front 一致：未登录时强制去登录
    gotoLogin()
    return null
  }

  // 若访问 / 但已登录，交由路由的 redirect 处理
  if (isAuthFree && !isInvalidUser) {
    // 避免已登录还停留在登录页
    return <Navigate to="/index" replace />
  }

  return <>{props.children}</>
}
