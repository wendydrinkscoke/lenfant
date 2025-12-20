import { useState } from "react"
import { toast } from "sonner"
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks"
import { getGallaudetApi } from "../../lib/gallaudet-api"
import { startCognitoOAuthFlowViaPopup } from "../../lib/auth-utils"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

interface ConfigureSecretsPanelProps {
  experienceId: string | null
}

const ROBLOX_SECRET_SCOPES = ["universe.secret:write", "universe.secret:read"]

export function ConfigureSecretsPanel({ experienceId }: ConfigureSecretsPanelProps) {
  const [isCreating, setIsCreating] = useState(false)

  const promptRobloxScopes = () => {
    const popup = startCognitoOAuthFlowViaPopup({
      roleOverride: "developer",
      includeRobloxAssociation: true,
      robloxScopes: ROBLOX_SECRET_SCOPES,
    })
    if (!popup) {
      toast.error("Please allow popups to continue onboarding.")
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
      let status: number | undefined

      if (error instanceof ResponseError) {
        status = error.response?.status
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

      if (status && status >= 400 && status < 500) {
        promptRobloxScopes()
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Secrets</p>
        <p className="text-sm text-muted-foreground">
          Vend an API key directly into your experience&apos;s Roblox Secret Store.
        </p>
      </div>
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
            <p className="text-xs">
              Requires Roblox scopes: {ROBLOX_SECRET_SCOPES.join(", ")}
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
