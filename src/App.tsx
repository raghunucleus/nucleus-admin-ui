import { useState } from "react"
import { Sparkles, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="text-base font-semibold">Nucleus Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Docs
            </Button>
            <Button size="sm">
              <Plus />
              New
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="grid gap-6 hd:grid-cols-2">
          <section className="rounded-lg border bg-card p-6 text-card-foreground">
            <h1 className="text-2xl font-semibold tracking-tight">
              Tailwind + shadcn is wired up
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              All colors, radius and breakpoints are driven by tokens in{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                src/index.css
              </code>
              . Change <code>--brand-hue</code> or any token to rebrand globally.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={() => setCount((c) => c + 1)}>
                Clicked {count}x
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">Theme tokens</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live preview of the centralized palette.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              {[
                ["primary", "bg-primary text-primary-foreground"],
                ["secondary", "bg-secondary text-secondary-foreground"],
                ["accent", "bg-accent text-accent-foreground"],
                ["muted", "bg-muted text-muted-foreground"],
                ["destructive", "bg-destructive text-destructive-foreground"],
                ["card", "bg-card text-card-foreground border"],
              ].map(([name, cls]) => (
                <div
                  key={name}
                  className={`flex h-16 items-center justify-center rounded-md ${cls}`}
                >
                  {name}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
