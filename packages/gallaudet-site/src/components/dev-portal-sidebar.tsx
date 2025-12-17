import { Plus, Sparkles, ListChecks, KeySquare, Loader2, AlertCircle, Boxes, Users, ChartLine } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { cn } from "../lib/utils"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { useEffect, useState } from "react"
import { getGallaudetApi } from "../lib/gallaudet-api"
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks"

type Experience = { id: string; name: string; status?: string }
type Feature = { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }
type UserInfo = { name: string; email: string; avatar?: string }

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  listing: Sparkles,
  tasks: ListChecks,
  secrets: KeySquare,
  assets: Boxes,
  roles: Users,
  metrics: ChartLine,
}

export function DevPortalSidebar({
  experiences,
  selectedExperience,
  onSelectExperience,
  addExperienceOpen,
  onAddExperienceOpenChange,
  onAddExperience,
  features,
  selectedFeature,
  onSelectFeature,
  user,
  ...props
}: {
  experiences: Experience[]
  selectedExperience: string | null
  onSelectExperience: (id: string) => void
  addExperienceOpen: boolean
  onAddExperienceOpenChange: (open: boolean) => void
  onAddExperience: (experience: Experience) => void
  features: Feature[]
  selectedFeature: string
  onSelectFeature: (id: string) => void
  user: UserInfo
} & React.ComponentProps<typeof Sidebar>) {
  const hasSelection = Boolean(
    selectedExperience && experiences.some((exp) => exp.id === selectedExperience)
  )

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="h-screen bg-sidebar text-sidebar-foreground border-r shadow-sm"
      {...props}
    >
      <SidebarHeader>
        <ExperienceSwitcher
          experiences={experiences}
          selectedExperience={selectedExperience}
          onSelectExperience={onSelectExperience}
          dialogOpen={addExperienceOpen}
          onDialogOpenChange={onAddExperienceOpenChange}
          onAddExperience={onAddExperience}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavFeatures
          features={features}
          selectedFeature={selectedFeature}
          onSelectFeature={onSelectFeature}
          disabled={!hasSelection}
        />
      </SidebarContent>
      <SidebarFooter>
        <UserBadge user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

function ExperienceSwitcher({
  experiences,
  selectedExperience,
  onSelectExperience,
  dialogOpen,
  onDialogOpenChange,
  onAddExperience,
}: {
  experiences: Experience[]
  selectedExperience: string | null
  onSelectExperience: (id: string) => void
  dialogOpen: boolean
  onDialogOpenChange: (open: boolean) => void
  onAddExperience: (experience: Experience) => void
}) {
  const active = selectedExperience
    ? experiences.find((exp) => exp.id === selectedExperience)
    : undefined
  const hasExperiences = experiences.length > 0
  const [experienceId, setExperienceId] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const isSubmitting = status === "loading"

  const canConfirm = Boolean(experienceId.trim()) && !isSubmitting

  useEffect(() => {
    if (!dialogOpen) {
      setExperienceId("")
      setStatus("idle")
      setStatusMessage("")
    }
  }, [dialogOpen])

  const handleConfirm = async () => {
    const trimmedId = experienceId.trim()
    if (!trimmedId) {
      setStatus("error")
      setStatusMessage("Universe ID is required.")
      return
    }
    if (!/^\d+$/.test(trimmedId)) {
      setStatus("error")
      setStatusMessage("Universe ID should only contain numbers.")
      return
    }

    setStatus("loading")
    setStatusMessage("Creating project...")

    try {
      const apiClient = await getGallaudetApi()
      await apiClient.createProject({ experienceId: trimmedId })

      onAddExperience({
        id: trimmedId,
        name: `Universe ${trimmedId}`,
        status: "Pending",
      })
      onDialogOpenChange(false)
    } catch (error) {
      let message = "Unable to create the project. Please try again."
      if (error instanceof ResponseError) {
        try {
          const data = await error.response.clone().json()
          if (typeof data?.message === "string") {
            message = data.message
          }
        } catch {
          // Fall back to the default error message.
        }
      } else if (error instanceof Error && error.message) {
        message = error.message
      }

      setStatus("error")
      setStatusMessage(message)
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (isSubmitting) return
    onDialogOpenChange(open)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                {active?.name?.slice(0, 1) ?? "E"}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active?.name ?? (hasExperiences ? "Select experience" : "No experiences yet")}
                </span>
                <span className="truncate text-xs">
                  {active?.status ?? (hasExperiences ? "Choose or add" : "Add your first experience")}
                </span>
              </div>
              <Plus className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Experiences</DropdownMenuLabel>
            {experiences.map((exp) => (
              <DropdownMenuItem
                key={exp.id}
                onClick={() => onSelectExperience(exp.id)}
                className={cn("gap-2 p-2", exp.id === selectedExperience && "bg-sidebar-accent text-sidebar-accent-foreground")}
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  {exp.name.slice(0, 1)}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{exp.name}</span>
                  <span className="text-xs text-muted-foreground">{exp.status ?? "Active"}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onSelect={() => onDialogOpenChange(true)}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add experience</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a Roblox experience</DialogTitle>
              <DialogDescription>
                Enter the Roblox universe ID (the number in your experience URL). We will verify ownership when you confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="experience-id">Universe ID</Label>
                <Input
                  id="experience-id"
                  placeholder="1278348231"
                  inputMode="numeric"
                  value={experienceId}
                  onChange={(event) => {
                    setExperienceId(event.target.value)
                    if (status === "error") {
                      setStatus("idle")
                      setStatusMessage("")
                    }
                  }}
                  disabled={isSubmitting}
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {status === "loading" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{statusMessage}</span>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-start gap-2 text-rose-600">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-semibold text-foreground">Unable to add experience</p>
                      <p className="text-xs text-muted-foreground">{statusMessage}</p>
                    </div>
                  </div>
                )}
                {status === "idle" && (
                  <p>Enter the Roblox universe ID and click confirm to add it.</p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavFeatures({
  features,
  selectedFeature,
  onSelectFeature,
  disabled,
}: {
  features: Feature[]
  selectedFeature: string
  onSelectFeature: (id: string) => void
  disabled: boolean
}) {
  const productIds = new Set(["listing", "tasks", "assets"])
  const operationIds = new Set(["secrets", "roles", "metrics"])
  const productFeatures = features.filter((item) => productIds.has(item.id))
  const operationFeatures = features.filter((item) => operationIds.has(item.id))

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Product</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {productFeatures.map((item) => {
              const Icon = item.icon ?? featureIcons[item.id] ?? Sparkles
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={!disabled && selectedFeature === item.id}
                    onClick={() => onSelectFeature(item.id)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={cn(
                      "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground w-full",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Operations</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {operationFeatures.map((item) => {
              const Icon = item.icon ?? featureIcons[item.id] ?? Sparkles
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={!disabled && selectedFeature === item.id}
                    onClick={() => onSelectFeature(item.id)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={cn(
                      "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground w-full",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

function UserBadge({ user }: { user: UserInfo }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg">{user.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
