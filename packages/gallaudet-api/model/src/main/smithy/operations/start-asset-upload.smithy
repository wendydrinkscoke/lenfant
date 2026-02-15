$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetContentType
use llc.civictech.school#AssetFileName
use llc.civictech.school#AssetId
use llc.civictech.school#AssetSizeBytes
use llc.civictech.school#AssetUploadSessionId
use llc.civictech.school#AssetUploadUrl
use llc.civictech.school#ExperienceId
use llc.civictech.school#Sha256Hex
use llc.civictech.school#UploadPartCount
use llc.civictech.school#UploadPartSizeBytes
use llc.civictech.school#UploadStrategy

/// Starts an upload session for an asset owned by a project.
///
/// The server chooses single-part or multipart upload strategy based on
/// metadata such as content type and size.
@http(method: "POST", uri: "/projects/{experienceId}/assets/uploads")
@handler(language: "typescript")
operation StartAssetUpload {
    input := {
        /// The project whose assets bucket namespace this upload belongs to.
        @required
        @httpLabel
        experienceId: ExperienceId

        /// Original file name selected by the user.
        @required
        fileName: AssetFileName

        /// MIME type of the file to upload.
        @required
        contentType: AssetContentType

        /// File size in bytes.
        @required
        contentLengthBytes: AssetSizeBytes

        /// Optional checksum provided by the client.
        checksumSha256: Sha256Hex
    }
    output := {
        /// Stable identifier for the asset record.
        @required
        assetId: AssetId

        /// Identifier for this in-progress upload session.
        @required
        uploadSessionId: AssetUploadSessionId

        /// Upload approach selected by the backend.
        @required
        strategy: UploadStrategy

        /// The point in time after which issued URLs should be treated as expired.
        @required
        expiresAt: Timestamp

        /// Present for single-part uploads.
        uploadUrl: AssetUploadUrl

        /// Present for multipart uploads.
        multipartPartSizeBytes: UploadPartSizeBytes

        /// Present for multipart uploads.
        multipartPartCount: UploadPartCount
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
