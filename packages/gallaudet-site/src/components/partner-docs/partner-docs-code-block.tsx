import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

type PartnerDocsCodeBlockProps = {
  title: string
  code: string
  className?: string
}

export function PartnerDocsCodeBlock({
  title,
  code,
  className,
}: PartnerDocsCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard API is unavailable in this browser.")
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success("Snippet copied")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Failed to copy snippet")
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">lua</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-zinc-950 p-4 text-xs text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  )
}
