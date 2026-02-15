$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetUploadSessionId
use llc.civictech.school#ExperienceId

/// Aborts an in-progress upload and cleans up partial objects.
@idempotent
@http(method: "DELETE", uri: "/projects/{experienceId}/assets/uploads/{uploadSessionId}")
@handler(language: "typescript")
operation AbortAssetUpload {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId

        @required
        @httpLabel
        uploadSessionId: AssetUploadSessionId
    }
    output := {
        @required
        message: String
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
