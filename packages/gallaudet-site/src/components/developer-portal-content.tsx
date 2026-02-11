import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { toast } from "sonner"
import { getGallaudetApi } from "../lib/gallaudet-api"
import { Boxes, ChartLine, KeyRound, ListChecks, Store, Users, FolderPlus } from "lucide-react"
import { DevPortalSidebar } from "./dev-portal-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb"
import { Separator } from "./ui/separator"
import type { AuthUser } from "../hooks/use-auth"
import { MarketplaceListingPanel } from "./developer-portal/marketplace-listing"
import { ConfigureTasksPanel } from "./developer-portal/configure-tasks"
import { ConfigureSecretsPanel } from "./developer-portal/configure-secrets"
import { AssetManagerPanel } from "./developer-portal/asset-manager"
import { RolesPanel } from "./developer-portal/roles"
import { MetricsPanel } from "./developer-portal/metrics"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty"
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks"

interface DeveloperPortalContentProps {
  user: AuthUser | null
}

export function DeveloperPortalContent({ user }: DeveloperPortalContentProps) {
  type Experience = { id: string; name: string; status?: string }
  const [experiences, setExperiences] = useState<Experience[]>([])
  const features = useMemo(
    () => [
      { id: "listing", label: "Marketplace Listing", icon: Store },
      { id: "tasks", label: "Tasks", icon: ListChecks },
      { id: "assets", label: "Asset Manager", icon: Boxes },
      { id: "secrets", label: "Secrets", icon: KeyRound },
      { id: "roles", label: "Roles", icon: Users },
      { id: "metrics", label: "Metrics", icon: ChartLine },
    ],
    [],
  )
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null)
  const [selectedFeature, setSelectedFeature] = useState(features[0]?.id ?? "")
  const [addExperienceOpen, setAddExperienceOpen] = useState(false)
  const [isLoadingExperiences, setIsLoadingExperiences] = useState(false)

  useEffect(() => {
    if (!experiences.length && selectedExperience !== null) {
      setSelectedExperience(null)
    }
  }, [experiences, selectedExperience])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!event.data || typeof event.data !== "object") return
      const { type } = event.data as { type?: string }

      if (type === "roblox-sign-in-complete") {
        toast.success("Roblox sign-in complete")
      }
      // Roblox OAuth-based flows removed; API key delegation is now manual via UI.
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      setIsLoadingExperiences(true)
      try {
        const apiClient = await getGallaudetApi()
        const response = await apiClient.listProjects()
        if (!isMounted) return

        const normalized = (response.projects ?? [])
          .map((project) => project.experienceId?.trim())
          .filter((id): id is string => Boolean(id))
          .map((id) => ({
            id,
            name: `Universe ${id}`,
            status: "Active",
          }))

        setExperiences((prev) => {
          const existing = new Set(prev.map((exp) => exp.id))
          const merged = [...prev]
          normalized.forEach((exp) => {
            if (!existing.has(exp.id)) {
              merged.push(exp)
            }
          })
          return merged
        })
        setSelectedExperience((prev) => prev ?? normalized[0]?.id ?? null)
      } catch (error) {
        if (!isMounted) return
        let message = "Unable to load experiences."
        if (error instanceof ResponseError) {
          try {
            const data = await error.response.clone().json()
            if (typeof data?.message === "string") {
              message = data.message
            }
          } catch {
            // Ignore parse errors and fall back to default message.
          }
        } else if (error instanceof Error && error.message) {
          message = error.message
        }
        toast.error("Failed to load experiences", {
          description: message,
        })
      } finally {
        if (isMounted) {
          setIsLoadingExperiences(false)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedExperienceName = experiences.find((e) => e.id === selectedExperience)?.name
  const hasSelection = Boolean(selectedExperienceName)

  const renderFeatureContent = (): ReactNode => {
    switch (selectedFeature) {
      case "listing":
        return <MarketplaceListingPanel />
      case "tasks":
        return <ConfigureTasksPanel />
      case "assets":
        return <AssetManagerPanel />
      case "secrets":
        return <ConfigureSecretsPanel experienceId={selectedExperience} />
      case "roles":
        return <RolesPanel />
      case "metrics":
        return <MetricsPanel />
      default:
        return <p className="text-sm text-muted-foreground">Select a feature to get started.</p>
    }
  }

  return (
    <SidebarProvider className="bg-background flex min-h-screen w-full">
      <DevPortalSidebar
        experiences={experiences}
        selectedExperience={selectedExperience}
        onSelectExperience={setSelectedExperience}
        addExperienceOpen={addExperienceOpen}
        onAddExperienceOpenChange={setAddExperienceOpen}
        onAddExperience={(experience) => {
          setExperiences((prev) => [...prev, experience])
          setSelectedExperience(experience.id)
          toast.success("Experience added", { description: `${experience.name} is now in your console.` })
        }}
        features={features}
        selectedFeature={selectedFeature}
        onSelectFeature={setSelectedFeature}
        user={{
          name: user?.name ?? user?.email ?? "Developer",
          email: user?.email ?? "developer@example.com",
          avatar: user?.picture ?? "",
        }}
      />

      <SidebarInset className="flex-1 px-4">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-0 md:px-0">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {hasSelection ? (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/create">Developer Console</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">{selectedExperienceName ?? "Experience"}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {features.find((f) => f.id === selectedFeature)?.label ?? "Feature"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>Developer Console</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="mt-6">
          {hasSelection ? (
            <Card>
              <CardContent className="space-y-4 pt-6">
                {renderFeatureContent()}
              </CardContent>
            </Card>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderPlus className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No experiences yet</EmptyTitle>
                <EmptyDescription>
                  {isLoadingExperiences
                    ? "Fetching your Roblox experiences..."
                    : "Add your first Roblox experience to configure listings, tasks, and secrets."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setAddExperienceOpen(true)} disabled={isLoadingExperiences}>
                  {isLoadingExperiences ? "Loading..." : "Add experience"}
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
