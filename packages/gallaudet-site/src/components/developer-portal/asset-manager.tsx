import { useState } from "react"
import {
  AssetContentType,
  AssetRecord,
  ResponseError,
} from "gallaudet-api-typescript-react-query-hooks"
import { toast } from "sonner"
import { getGallaudetApi } from "../../lib/gallaudet-api"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"

interface AssetManagerPanelProps {
  experienceId: string | null
}

const ALLOWED_CONTENT_TYPES: AssetContentType[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]

const normalizeContentType = (file: File): AssetContentType | null => {
  const fromMime = file.type?.trim().toLowerCase()
  if (fromMime === "image/jpg") {
    return "image/jpeg"
  }
  if (ALLOWED_CONTENT_TYPES.includes(fromMime as AssetContentType)) {
    return fromMime as AssetContentType
  }

  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith(".png")) return "image/png"
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg"
  if (lowerName.endsWith(".gif")) return "image/gif"
  if (lowerName.endsWith(".webp")) return "image/webp"
  return null
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
  return "Unexpected error."
}

const getEtagFromResponse = (response: Response): string | null => {
  const eTag = response.headers.get("ETag") ?? response.headers.get("etag")
  const normalized = eTag?.trim()
  return normalized ? normalized : null
}

const isMockUploadUrl = (url: string): boolean => url.startsWith("mock://")

export function AssetManagerPanel({ experienceId }: AssetManagerPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [lastUploadedAsset, setLastUploadedAsset] = useState<AssetRecord | null>(null)

  const handleUpload = async () => {
    if (!experienceId) {
      toast.error("Select an experience before uploading.")
      return
    }
    if (!selectedFile) {
      toast.error("Select a file to upload.")
      return
    }

    const contentType = normalizeContentType(selectedFile)
    if (!contentType) {
      toast.error("Unsupported file type.", {
        description: "Use PNG, JPEG, GIF, or WEBP.",
      })
      return
    }

    setIsUploading(true)
    setProgressPercent(0)
    setLastUploadedAsset(null)

    let uploadSessionId: string | null = null
    let api: Awaited<ReturnType<typeof getGallaudetApi>> | null = null

    try {
      api = await getGallaudetApi()
      const startResponse = await api.startAssetUpload({
        experienceId,
        startAssetUploadRequestContent: {
          fileName: selectedFile.name,
          contentType,
          contentLengthBytes: selectedFile.size,
        },
      })
      uploadSessionId = startResponse.uploadSessionId

      let uploadedAsset: AssetRecord
      if (startResponse.strategy === "single-part-put") {
        if (!startResponse.uploadUrl) {
          throw new Error("Upload URL missing from start upload response.")
        }

        let eTag: string | null = null
        if (isMockUploadUrl(startResponse.uploadUrl)) {
          eTag = "mock-single-part-etag"
        } else {
          const uploadResponse = await fetch(startResponse.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": contentType,
            },
            body: selectedFile,
          })
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status ${uploadResponse.status}.`)
          }
          eTag = getEtagFromResponse(uploadResponse)
          if (!eTag) {
            throw new Error("Upload succeeded but ETag header was missing.")
          }
        }

        setProgressPercent(95)
        const completeResponse = await api.completeAssetUpload({
          experienceId,
          uploadSessionId: startResponse.uploadSessionId,
          completeAssetUploadRequestContent: {
            completion: {
              singlePart: {
                eTag,
              },
            },
          },
        })
        uploadedAsset = completeResponse.asset
      } else {
        const partCount = startResponse.multipartPartCount
        const partSizeBytes = startResponse.multipartPartSizeBytes
        if (!partCount || !partSizeBytes) {
          throw new Error("Multipart upload details were missing from the start response.")
        }

        const parts: { partNumber: number; eTag: string }[] = []
        for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
          const startByte = (partNumber - 1) * partSizeBytes
          const endByte = Math.min(selectedFile.size, startByte + partSizeBytes)
          const chunk = selectedFile.slice(startByte, endByte)

          const partResponse = await api.getAssetUploadPartUrl({
            experienceId,
            uploadSessionId: startResponse.uploadSessionId,
            partNumber,
          })

          let eTag: string | null = null
          if (isMockUploadUrl(partResponse.uploadUrl)) {
            eTag = `mock-multipart-part-${partNumber}-etag`
          } else {
            const uploadPartResponse = await fetch(partResponse.uploadUrl, {
              method: "PUT",
              body: chunk,
            })
            if (!uploadPartResponse.ok) {
              throw new Error(`Part ${partNumber} upload failed with status ${uploadPartResponse.status}.`)
            }
            eTag = getEtagFromResponse(uploadPartResponse)
            if (!eTag) {
              throw new Error(`Part ${partNumber} upload succeeded but ETag header was missing.`)
            }
          }

          parts.push({
            partNumber,
            eTag,
          })
          setProgressPercent(Math.floor((partNumber / partCount) * 90))
        }

        setProgressPercent(95)
        const completeResponse = await api.completeAssetUpload({
          experienceId,
          uploadSessionId: startResponse.uploadSessionId,
          completeAssetUploadRequestContent: {
            completion: {
              multipart: {
                parts,
              },
            },
          },
        })
        uploadedAsset = completeResponse.asset
      }

      setProgressPercent(100)
      setSelectedFile(null)
      setLastUploadedAsset(uploadedAsset)
      toast.success("Asset uploaded", {
        description: `Asset ${uploadedAsset.assetId} is ready.`,
      })
    } catch (error) {
      if (uploadSessionId && api) {
        try {
          await api.abortAssetUpload({
            experienceId,
            uploadSessionId,
          })
        } catch {
          // Ignore cleanup errors so the user sees the root cause first.
        }
      }

      toast.error("Upload failed", {
        description: await getErrorMessage(error),
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Asset Manager</p>
        <p className="text-sm text-muted-foreground">Organize thumbnails, badges, and media for your listing.</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload an asset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Upload PNG, JPEG, GIF, or WEBP assets. Large files automatically use multipart upload.
          </p>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={!experienceId || isUploading}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null)
            }}
          />
          {selectedFile ? (
            <p>
              Selected: <span className="font-medium text-foreground">{selectedFile.name}</span> ({Math.ceil(selectedFile.size / 1024)} KB)
            </p>
          ) : null}

          {progressPercent !== null ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {isUploading ? "Uploading" : "Last upload"}: {progressPercent}%
              </p>
              <div className="h-2 w-full rounded bg-muted">
                <div
                  className="h-2 rounded bg-foreground transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={!experienceId || !selectedFile || isUploading}>
              {isUploading ? "Uploading..." : "Upload asset"}
            </Button>
          </div>

          {lastUploadedAsset ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-foreground">
              <p>
                <span className="font-semibold">Asset ID:</span> {lastUploadedAsset.assetId}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {lastUploadedAsset.status}
              </p>
              <p className="break-all">
                <span className="font-semibold">Object key:</span> {lastUploadedAsset.objectKey}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
