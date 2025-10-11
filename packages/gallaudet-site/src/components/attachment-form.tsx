import type React from "react"

import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Alert, AlertDescription } from "../components/ui/alert"
import { CheckCircle, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { getGallaudetApi } from "../lib/gallaudet-api"
import type { TaskTypes } from "gallaudet-api-typescript-react-query-hooks"

const assignmentTypes = [
  { value: "tour-whitehouse", label: "Tour the White House" },
  { value: "filibuster", label: "Filibuster a Bill" },
  { value: "draft-bill", label: "Draft a Bill" },
  { value: "press-briefing", label: "Attend Press Briefing" },
  { value: "committee-hearing", label: "Committee Hearing" },
  { value: "custom", label: "Custom Assignment" },
]

export default function AttachmentForm() {
  const [isCreating, setIsCreating] = useState(false)
  const [assignmentType, setAssignmentType] = useState("")
  const [searchParams] = useSearchParams()

  const courseId = searchParams.get("courseId")
  const itemId = searchParams.get("itemId")
  const itemType = searchParams.get("itemType")
  const addOnToken = searchParams.get("addOnToken")

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
      const response = await client.attachTask({
        attachTaskRequestContent: {
          courseId,
          itemId,
          itemType,
          addOnToken,
          assignmentType: assignmentType as TaskTypes,
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

          <div className="space-y-2">
            <Label htmlFor="assignmentType">{"Assignment Type"}</Label>
            <Select value={assignmentType} onValueChange={setAssignmentType} required>
              <SelectTrigger id="assignmentType">
                <SelectValue placeholder="Select an assignment type" />
              </SelectTrigger>
              <SelectContent>
                {assignmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isCreating || !assignmentType}
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
