import { useState } from "react"
import { toast } from "sonner"
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks"
import { getGallaudetApi } from "../../lib/gallaudet-api"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"

interface ConfigureSecretsPanelProps {
  experienceId: string | null
}

export function ConfigureSecretsPanel({ experienceId }: ConfigureSecretsPanelProps) {
  const [apiKey, setApiKey] = useState("")
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleSaveApiKey = async () => {
    if (!experienceId) {
      toast.error("Select an experience before saving an API key.")
      return
    }
    if (!apiKey.trim()) {
      toast.error("Enter your Roblox API key.")
      return
    }
    setIsSavingKey(true)
    try {
      const api = await getGallaudetApi()
      await api.delegateRobloxSecretStoreAccess({
        delegateRobloxSecretStoreAccessRequestContent: {
          apiKey: apiKey.trim(),
          experienceId,
        } as any,
      })
      toast.success("API key saved", {
        description: "We'll use this key to manage secrets for your experience.",
      })
    } catch (error) {
      let message = "Unable to save API key."
      if (error instanceof ResponseError) {
        try {
          const data = await error.response.clone().json()
          if (typeof data?.message === "string") {
            message = data.message
          }
        } catch {
          // ignore parse errors
        }
      } else if (error instanceof Error && error.message) {
        message = error.message
      }
      toast.error("Failed to save API key", { description: message })
    } finally {
      setIsSavingKey(false)
    }
  }

  const handleCreateSecret = async () => {
    if (!experienceId) {
      toast.error("Select an experience before creating a secret.")
      return
    }
    setIsCreating(true)
    try {
      const api = await getGallaudetApi()
      const resp = await api.vendSecret({ experienceId })
      toast.success("Secret created", {
        description: `Secret ID ${resp.secretId} stored for universe ${experienceId}.`,
      })
    } catch (error) {
      let message = "Unable to create secret."
      if (error instanceof ResponseError) {
        try {
          const data = await error.response.clone().json()
          if (typeof data?.message === "string") {
            message = data.message
          }
        } catch {
          // Ignore parse errors.
        }
      } else if (error instanceof Error && error.message) {
        message = error.message
      }

      toast.error("Secret creation failed", { description: message })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Secrets</p>
        <p className="text-sm text-muted-foreground">
          Provide your Roblox API key, then vend an API key directly into your experience&apos;s Roblox Secret Store.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Save Roblox API key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Paste the API key you created in Roblox Creator Dashboard for this universe.
          </p>
          <Input
            type="password"
            placeholder="rbx-api-key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isSavingKey}
          />
          <div className="flex justify-end">
            <Button onClick={handleSaveApiKey} disabled={!experienceId || isSavingKey}>
              {isSavingKey ? "Saving..." : "Save API key"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Create a secret</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              We&apos;ll generate an API key for Gallaudet and encrypt it with your experience&apos;s Roblox
              public key.
            </p>
          </div>
          <Button onClick={handleCreateSecret} disabled={!experienceId || isCreating}>
            {isCreating ? "Creating..." : "Create secret"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
