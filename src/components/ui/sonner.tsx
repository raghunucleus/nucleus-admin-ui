import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

// `richColors` is intentionally OFF and the surface classNames (bg-card/border/
// shadow) are dropped: the glass toast look lives in `index.css` as a neutral
// frosted surface for every toast, with type shown via a colored left accent +
// tinted icon. Solid fills / an opaque card bg would fight that.
function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
