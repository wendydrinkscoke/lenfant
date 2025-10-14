import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Alert, AlertDescription } from "../components/ui/alert"
import { CheckCircle, Loader2, FileText, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { getGallaudetApi } from "../lib/gallaudet-api"

type CatalogOption = {
  value: string
  label: string
  partnerId: string
  partnerName: string
}

export default function AttachmentForm() {
  const [isCreating, setIsCreating] = useState(false)
  const [assignmentType, setAssignmentType] = useState("")
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  const courseId = searchParams.get("courseId")
  const itemId = searchParams.get("itemId")
  const itemType = searchParams.get("itemType")
  const addOnToken = searchParams.get("addOnToken")

  useEffect(() => {
    let cancelled = false

    const fetchCatalog = async () => {
      setIsCatalogLoading(true)
      setCatalogError(null)

      try {
        const client = await getGallaudetApi()
        const response = await client.getTaskCatalog()

        if (cancelled) {
          return
        }

        const options: CatalogOption[] =
          response.partners?.flatMap((partner) =>
            partner.catalogEntries?.map((entry) => ({
              value: entry.entryId,
              label: entry.name,
              partnerId: partner.partnerId,
              partnerName: partner.partnerName ?? partner.partnerId,
            })) ?? [],
          ) ?? []

        options.sort((a, b) => a.label.localeCompare(b.label))

        setCatalogOptions(options)
        setAssignmentType((prev) =>
          options.some((option) => option.value === prev) ? prev : "",
        )
      } catch (error: any) {
        if (!cancelled) {
          console.error(error)
          setCatalogError(error?.message ?? "Failed to load task catalog")
        }
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false)
        }
      }
    }

    fetchCatalog()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      if (!assignmentType) {
        throw new Error("Select an assignment type before submitting.")
      }

      if (!courseId || !itemId || !itemType || !addOnToken) {
        throw new Error("Missing Google Classroom context from iframe.")
      }

      const client = await getGallaudetApi()
      const selectedOption = catalogOptions.find((option) => option.value === assignmentType)
      if (!selectedOption) {
        throw new Error("Selected assignment type not found")
      }

      if (itemType !== "courseWork") {
        throw new Error("Only courseWork itemType is currently supported")
      }

      const response = await client.attachTask({
        courseId,
        itemId,
        attachTaskRequestContent: {
          itemType,
          addOnToken,
          partnerId: selectedOption.partnerId,
          entryId: selectedOption.value,
        },
      })

      toast.success(response.message ?? "Created in-game assignment!")

      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Close the iframe.
      // https://shorturl.at/SfAbo
      window.parent.postMessage(
        {
          type: "Classroom",
          action: "closeIframe",
        },
        "*"
      )
    } catch (error: any) {
      console.error(error)
      const message = error?.message ?? "Error creating attachment"
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            {"Create Attachment"}
          </CardTitle>
          <CardDescription>
            {"Choose the assignment type to attach to this Classroom item."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-sm">
              {"This attachment will be synced with Google Classroom and visible to students in the Roblox simulation."}
            </AlertDescription>
          </Alert>

          {catalogError && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {catalogError}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignmentType">{"Assignment Type"}</Label>
            <Select
              value={assignmentType}
              onValueChange={setAssignmentType}
              required
              disabled={isCatalogLoading || !!catalogError || catalogOptions.length === 0}
            >
              <SelectTrigger id="assignmentType" disabled={isCatalogLoading || !!catalogError || catalogOptions.length === 0}>
                <SelectValue placeholder={isCatalogLoading ? "Loading assignments..." : "Select an assignment type"} />
              </SelectTrigger>
              <SelectContent>
                {catalogOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.partnerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isCatalogLoading && !catalogError && catalogOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No catalog entries are available yet. Register tasks in the catalog to enable this selection.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={
              isCreating ||
              !assignmentType ||
              isCatalogLoading ||
              !!catalogError ||
              catalogOptions.length === 0
            }
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {"Creating..."}
              </>
            ) : (
              "Create Attachment"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
