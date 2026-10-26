import type { ComponentType } from 'react'

// App.tsx registers its /app/* route tree here so each workspace tab can render the same pages
// without importing App.tsx (which would create an import cycle through Layout).
let appRoutes: ComponentType | null = null

export function registerAppRoutes(component: ComponentType) {
  appRoutes = component
}

export function getAppRoutes(): ComponentType | null {
  return appRoutes
}
