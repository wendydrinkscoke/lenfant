import { useCallback, useEffect, useMemo, useState } from "react"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { MoreHorizontal, RefreshCw } from "lucide-react"
import type { ExperienceTaskCatalog } from "gallaudet-api-typescript-react-query-hooks"
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks"
import { getGallaudetApi } from "../../lib/gallaudet-api"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"

interface ConfigureTasksPanelProps {
  experienceId: string | null
}

type TaskCatalogRow = {
  entryId: string
  name: string
  subheading: string
  instructions: string
  assetIds?: string[]
  milestones?: ExperienceTaskCatalog["catalogEntries"][number]["milestones"]
  milestoneCount: number
  assetCount: number
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-normal align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No tasks found for this experience.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof ResponseError) {
    try {
      const data = await error.response.clone().json()
      if (typeof data?.message === "string") {
        return data.message
      }
    } catch {
      // Ignore parse errors.
    }
    return `Request failed with status ${error.response.status}.`
  }

  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Unable to load tasks."
}

const buildRowsForExperience = (
  catalog: ExperienceTaskCatalog | undefined,
): TaskCatalogRow[] => {
  if (!catalog) {
    return []
  }

  return (catalog.catalogEntries ?? [])
    .map((entry) => ({
      entryId: entry.entryId,
      name: entry.name,
      subheading: entry.subheading,
      instructions: entry.instructions,
      assetIds: entry.assetIds,
      milestones: entry.milestones,
      milestoneCount: entry.milestones?.length ?? 0,
      assetCount: entry.assetIds?.length ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function ConfigureTasksPanel({ experienceId }: ConfigureTasksPanelProps) {
  const [rows, setRows] = useState<TaskCatalogRow[]>([])
  const [selectedExperienceName, setSelectedExperienceName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    if (!experienceId) {
      setRows([])
      setSelectedExperienceName(null)
      setLoadError(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const api = await getGallaudetApi()
      const response = await api.getTaskCatalogForProject({ experienceId })
      const experience = response.experience

      setRows(buildRowsForExperience(experience))
      setSelectedExperienceName(experience?.experienceName ?? null)
    } catch (error) {
      setRows([])
      setSelectedExperienceName(null)
      setLoadError(await getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [experienceId])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  const handlePreview = useCallback(
    (entryId: string) => {
      if (!experienceId) {
        return
      }

      const url = new URL("/task-preview", window.location.origin)
      url.searchParams.set("experienceId", experienceId)
      url.searchParams.set("entryId", entryId)
      window.open(url.toString(), "_blank", "noopener,noreferrer")
    },
    [experienceId],
  )

  const handleCopyAsJson = useCallback((row: TaskCatalogRow) => {
    const payload = {
      entryId: row.entryId,
      name: row.name,
      subheading: row.subheading,
      instructions: row.instructions,
      assetIds: row.assetIds ?? [],
      milestones: row.milestones ?? [],
    }
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }, [])

  const columns = useMemo<ColumnDef<TaskCatalogRow>[]>(
    () => [
      {
        accessorKey: "entryId",
        header: "Entry ID",
        cell: ({ row }) => (
          <code className="text-xs">{row.original.entryId}</code>
        ),
      },
      {
        accessorKey: "name",
        header: "Task",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.subheading}</p>
          </div>
        ),
      },
      {
        accessorKey: "instructions",
        header: "Instructions",
        cell: ({ row }) => (
          <p className="line-clamp-3 max-w-xl text-sm text-muted-foreground">
            {row.original.instructions}
          </p>
        ),
      },
      {
        accessorKey: "milestoneCount",
        header: "Milestones",
        cell: ({ row }) => <span className="tabular-nums">{row.original.milestoneCount}</span>,
      },
      {
        accessorKey: "assetCount",
        header: "Assets",
        cell: ({ row }) => <span className="tabular-nums">{row.original.assetCount}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  handlePreview(row.original.entryId)
                }}
              >
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleCopyAsJson(row.original)
                }}
              >
                Copy as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleCopyAsJson, handlePreview],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Tasks</p>
          <p className="text-sm text-muted-foreground">
            Read-only view of the teacher-facing task catalog for the selected experience.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadTasks()
          }}
          disabled={!experienceId || isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!experienceId ? (
        <p className="text-sm text-muted-foreground">
          Select an experience to view its task catalog.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Experience ID: <code>{experienceId}</code></span>
            {selectedExperienceName ? (
              <span>({selectedExperienceName})</span>
            ) : null}
          </div>

          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : isLoading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading task catalog...</p>
          ) : (
            <DataTable columns={columns} data={rows} />
          )}
        </>
      )}
    </div>
  )
}
