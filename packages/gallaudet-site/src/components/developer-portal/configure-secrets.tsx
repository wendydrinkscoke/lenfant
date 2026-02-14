import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  DelegateRobloxSecretStoreAccessRequest,
  GetRobloxSecretStoreAccessStatusRequest,
  ResponseError,
} from "gallaudet-api-typescript-react-query-hooks"
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
  const [isCheckingDelegationStatus, setIsCheckingDelegationStatus] = useState(false)
  const [hasDelegatedSecretStoreAccess, setHasDelegatedSecretStoreAccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    if (!experienceId) {
      setHasDelegatedSecretStoreAccess(false)
      setIsCheckingDelegationStatus(false)
      return () => {
        isMounted = false
      }
    }

    ;(async () => {
      setIsCheckingDelegationStatus(true)
      try {
        const api = await getGallaudetApi()
        const request: GetRobloxSecretStoreAccessStatusRequest = {
          experienceId,
        }
        const response = await api.getRobloxSecretStoreAccessStatus(request)
        if (!isMounted) return
        setHasDelegatedSecretStoreAccess(Boolean(response.delegated))
      } catch (error) {
        if (!isMounted) return
        setHasDelegatedSecretStoreAccess(false)
      } finally {
        if (isMounted) {
          setIsCheckingDelegationStatus(false)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [experienceId])

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
      const request: DelegateRobloxSecretStoreAccessRequest = {
        delegateRobloxSecretStoreAccessRequestContent: {
          apiKey: apiKey.trim(),
          experienceId,
        },
      }
      await api.delegateRobloxSecretStoreAccess(request)
      setHasDelegatedSecretStoreAccess(true)
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
    if (!hasDelegatedSecretStoreAccess) {
      toast.error("Save your Roblox API key first.", {
        description: "Create secret is available after secret store access is delegated.",
      })
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
          <CardTitle className="text-base">Step 1: Save Roblox API key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Paste the API key you created in{" "}
            <a
              href="https://create.roblox.com/dashboard/credentials"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Roblox Creator Dashboard
            </a>{" "}
            for this universe. The key must include <code>secret-store:write</code> and{" "}
            <code>secret-store:read</code> permissions. Note the latter does not let us read secret values;
            it lets us list secret metadata and is used to rotate secrets periodically.
          </p>
          <Input
            type="password"
            placeholder="+8ab+3sadk+BAeFXZ..."
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
          <CardTitle className="text-base">Step 2: Create a secret</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            {isCheckingDelegationStatus ? (
              <p>Checking whether Roblox Secret Store access has been delegated...</p>
            ) : hasDelegatedSecretStoreAccess ? (
              <p>
                We&apos;ll generate an API key for Gallaudet and encrypt it with your experience&apos;s Roblox
                public key.
              </p>
            ) : (
              <p>Complete Step 1 before creating a secret for this experience.</p>
            )}
          </div>
          <Button
            onClick={handleCreateSecret}
            disabled={!experienceId || isCreating || isCheckingDelegationStatus || !hasDelegatedSecretStoreAccess}
          >
            {isCreating ? "Creating..." : "Create secret"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
