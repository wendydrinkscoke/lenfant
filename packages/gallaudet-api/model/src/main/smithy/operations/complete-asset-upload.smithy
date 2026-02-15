$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetRecord
use llc.civictech.school#AssetUploadSessionId
use llc.civictech.school#CompletedUploadParts
use llc.civictech.school#ExperienceId
use llc.civictech.school#S3EntityTag

/// Completion payload for a single-part upload.
structure SinglePartAssetUploadCompletion {
    @required
    eTag: S3EntityTag
}

/// Completion payload for a multipart upload.
structure MultipartAssetUploadCompletion {
    @required
    parts: CompletedUploadParts
}

/// Exactly one of singlePart or multipart completion details.
union AssetUploadCompletionPayload {
    singlePart: SinglePartAssetUploadCompletion
    multipart: MultipartAssetUploadCompletion
}

/// Finalizes an upload session and persists the asset metadata.
@http(method: "POST", uri: "/projects/{experienceId}/assets/uploads/{uploadSessionId}/complete")
@handler(language: "typescript")
operation CompleteAssetUpload {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId

        @required
        @httpLabel
        uploadSessionId: AssetUploadSessionId

        @required
        completion: AssetUploadCompletionPayload
    }
    output := {
        @required
        asset: AssetRecord
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
