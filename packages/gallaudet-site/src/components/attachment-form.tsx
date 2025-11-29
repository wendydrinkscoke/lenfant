import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Alert, AlertDescription } from "../components/ui/alert"
import { Badge } from "../components/ui/badge"
import { Skeleton } from "../components/ui/skeleton"
import { CheckCircle, Loader2, AlertCircle, Sparkles, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { getGallaudetApi } from "../lib/gallaudet-api"
import { cn } from "../lib/utils"
import type { Milestone } from "gallaudet-api-typescript-react-query-hooks"

type CatalogEntry = {
  entryId: string
  name: string
  subheading: string
  instructions: string
  milestones: Milestone[] | undefined
  partnerId: string
  partnerName: string
}

type CatalogPartner = {
  partnerId: string
  partnerName: string
  catalogEntries: CatalogEntry[]
}

export default function AttachmentForm() {
  const [isCreating, setIsCreating] = useState(false)
  const [assignmentType, setAssignmentType] = useState("")
  const [catalogPartners, setCatalogPartners] = useState<CatalogPartner[]>([])
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

        const partners: CatalogPartner[] =
          response.partners
            ?.map((partner) => ({
              partnerId: partner.partnerId,
              partnerName: partner.partnerName ?? partner.partnerId,
              catalogEntries:
                partner.catalogEntries
                  ?.map((entry) => ({
                    entryId: entry.entryId,
                    name: entry.name,
                    subheading: entry.subheading,
                    instructions: entry.instructions,
                    milestones: entry.milestones,
                    partnerId: partner.partnerId,
                    partnerName: partner.partnerName ?? partner.partnerId,
                  }))
                  .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
            }))
            .filter((partner) => Boolean(partner.partnerId && partner.catalogEntries.length)) ?? []

        partners.sort((a, b) => a.partnerName.localeCompare(b.partnerName))

        if (cancelled) {
          return
        }

        setCatalogPartners(partners)

        const allEntryIds = partners.flatMap((partner) => partner.catalogEntries.map((entry) => entry.entryId))
        setAssignmentType((prev) => (allEntryIds.includes(prev) ? prev : ""))
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

  const selectedEntry = useMemo(
    () =>
      catalogPartners
        .flatMap((partner) => partner.catalogEntries)
        .find((entry) => entry.entryId === assignmentType),
    [assignmentType, catalogPartners],
  )

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
      if (!selectedEntry) {
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
          partnerId: selectedEntry.partnerId,
          entryId: selectedEntry.entryId,
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
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2 border-b bg-gradient-to-r from-emerald-50 via-white to-sky-50">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <Sparkles className="h-4 w-4" />
            {"Create Attachment"}
          </div>
          <CardTitle className="text-3xl">{"Choose from our catalog"}</CardTitle>
          <CardDescription className="text-base text-slate-700">
            {"Engaging, educational tasks developed by our partners. Pick the one you want to attach to this Classroom item."}
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

          <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{"Browse the partner catalog"}</p>
                <p className="text-sm text-muted-foreground">
                  {"Tap a card to preview and select an assignment from that partner."}
                </p>
                <p className="text-sm text-emerald-700">
                  {"This attachment will be synced with Google Classroom and visible to students in the Roblox simulation."}
                </p>
              </div>
              {selectedEntry && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  {"Selected"}
                </Badge>
              )}
            </div>

            <div className="mt-6 space-y-10">
              {isCatalogLoading && (
                <>
                  {[0, 1].map((row) => (
                    <div key={row} className="space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-64" />
                      </div>
                      <div className="flex gap-4 overflow-hidden">
                        {[0, 1, 2].map((item) => (
                          <Skeleton key={item} className="h-40 w-64 rounded-xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!isCatalogLoading && !catalogError && catalogPartners.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {"No catalog entries are available yet. Register tasks to start assigning them here."}
                </div>
              )}

              {!isCatalogLoading && catalogPartners.length > 0 && (
                catalogPartners.map((partner) => {
                  const featuredSubheading = partner.catalogEntries[0]?.subheading
                  return (
                    <div key={partner.partnerId} className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{"Partner"}</p>
                          <h3 className="text-xl font-semibold text-slate-900">{partner.partnerName}</h3>
                          {featuredSubheading ? (
                            <p className="text-sm font-medium text-slate-800">{featuredSubheading}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {"Classroom-ready activities from this game partner."}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {partner.catalogEntries.length} {"task"}{partner.catalogEntries.length === 1 ? "" : "s"}
                        </Badge>
                      </div>

                      <div className="relative">
                        <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {partner.catalogEntries.map((entry) => {
                            const isSelected = assignmentType === entry.entryId
                            return (
                              <button
                                key={entry.entryId}
                                type="button"
                                onClick={() => setAssignmentType(entry.entryId)}
                                className={cn(
                                  "group relative w-72 shrink-0 rounded-xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                                  isSelected
                                    ? "border-emerald-200 bg-emerald-50 ring-2 ring-emerald-200"
                                    : "border-slate-200"
                                )}
                                aria-pressed={isSelected}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Badge variant={isSelected ? "default" : "outline"} className={cn(isSelected ? "" : "border-slate-200 text-slate-700")}>
                                    {isSelected ? "Chosen" : "Task"}
                                  </Badge>
                                  <ArrowRight className={cn("h-4 w-4 text-slate-400 transition group-hover:translate-x-1", isSelected && "text-emerald-600")} />
                                </div>
                                <p className="mt-3 text-base font-semibold text-slate-900">{entry.name}</p>
                                <p className="mt-1 text-sm font-medium text-emerald-700">{entry.subheading}</p>
                                <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                                  {entry.instructions}
                                </p>
                                <div className="mt-4 flex items-center gap-2">
                                  <Badge variant="secondary" className="border-transparent bg-slate-100 text-slate-800">
                                    {entry.partnerName}
                                  </Badge>
                                  {entry.milestones && entry.milestones.length > 0 && (
                                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                      {entry.milestones.length} {"milestone"}{entry.milestones.length === 1 ? "" : "s"}
                                    </Badge>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-emerald-400/70 ring-offset-2" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {selectedEntry && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <div className="space-y-0.5">
                <p className="font-semibold">{selectedEntry.name}</p>
                <p className="text-xs text-emerald-800">
                  {selectedEntry.partnerName} {"•"} {selectedEntry.subheading}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAssignmentType("")}>
                {"Clear"}
              </Button>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              isCreating ||
              !assignmentType ||
              isCatalogLoading ||
              !!catalogError ||
              catalogPartners.length === 0
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
