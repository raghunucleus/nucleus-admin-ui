import { Outlet } from "@tanstack/react-router"

import { NucleusLogo } from "@/components/brand"

export function AuthLayout() {
  return (
    <div className="grid min-h-full place-items-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center">
          <NucleusLogo markSize={40} wordmarkHeight={18} eyebrow="Admin Console" />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
