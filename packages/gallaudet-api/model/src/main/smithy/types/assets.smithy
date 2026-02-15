$version: "2"
namespace llc.civictech.school

/// CivicTech-generated identifier for a managed asset.
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
string AssetId

/// References to assets that have already been uploaded.
list AssetIds {
    member: AssetId
}

/// Identifier for an in-progress upload session.
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
string AssetUploadSessionId

/// Original client-side file name.
@length(min: 1, max: 255)
string AssetFileName

/// File size in bytes.
@range(min: 1, max: 2147483648)
long AssetSizeBytes

/// Allowed media content types for the first iteration of the asset manager.
enum AssetContentType {
    IMAGE_PNG = "image/png"
    IMAGE_JPEG = "image/jpeg"
    IMAGE_GIF = "image/gif"
    IMAGE_WEBP = "image/webp"
}

/// Server-selected upload strategy.
enum UploadStrategy {
    SINGLE_PART_PUT = "single-part-put"
    MULTIPART_PUT = "multipart-put"
}

/// Lifecycle state of an asset record.
enum AssetStatus {
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
}

/// SHA-256 checksum represented as 64 lowercase or uppercase hex characters.
@pattern("^[A-Fa-f0-9]{64}$")
string Sha256Hex

/// Object key in the service-managed S3 assets bucket.
@length(min: 1, max: 1024)
string AssetObjectKey

/// URL that the client can use to upload bytes directly to S3.
@length(min: 1, max: 4096)
string AssetUploadUrl

/// S3 multipart upload part number.
@range(min: 1, max: 10000)
integer UploadPartNumber

/// Number of parts expected in the multipart upload plan.
@range(min: 1, max: 10000)
integer UploadPartCount

/// Planned part size for multipart uploads.
@range(min: 5242880, max: 104857600)
integer UploadPartSizeBytes

/// Opaque ETag value returned by S3 for a successful upload.
@length(min: 1, max: 128)
string S3EntityTag

/// Metadata returned to clients for a successfully created asset.
structure AssetRecord {
    @required
    assetId: AssetId

    @required
    experienceId: ExperienceId

    @required
    fileName: AssetFileName

    @required
    contentType: AssetContentType

    @required
    sizeBytes: AssetSizeBytes

    @required
    objectKey: AssetObjectKey

    @required
    status: AssetStatus

    @required
    createdAt: Timestamp

    @required
    updatedAt: Timestamp
}

/// Multipart completion record for one uploaded part.
structure CompletedUploadPart {
    @required
    partNumber: UploadPartNumber

    @required
    eTag: S3EntityTag
}

list CompletedUploadParts {
    member: CompletedUploadPart
}
