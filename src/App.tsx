import { RouterProvider } from "@tanstack/react-router"

import { ConnectivityMonitor } from "@/components/connectivity/connectivity-monitor"
import { ThemedToaster } from "@/components/themed-toaster"
import { router } from "@/router"

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ConnectivityMonitor />
      <ThemedToaster />
    </>
  )
}

export default App
