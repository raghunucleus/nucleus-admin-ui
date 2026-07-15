import { RouterProvider } from "@tanstack/react-router"

import { ThemedToaster } from "@/components/themed-toaster"
import { router } from "@/router"

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ThemedToaster />
    </>
  )
}

export default App
