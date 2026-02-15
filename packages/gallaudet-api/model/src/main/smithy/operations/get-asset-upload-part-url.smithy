$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetUploadSessionId
use llc.civictech.school#AssetUploadUrl
use llc.civictech.school#ExperienceId
use llc.civictech.school#UploadPartNumber

/// Issues a presigned URL for one multipart upload part.
@http(method: "POST", uri: "/projects/{experienceId}/assets/uploads/{uploadSessionId}/parts/{partNumber}")
@handler(language: "typescript")
operation GetAssetUploadPartUrl {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId

        @required
        @httpLabel
        uploadSessionId: AssetUploadSessionId

        @required
        @httpLabel
        partNumber: UploadPartNumber
    }
    output := {
        @required
        uploadUrl: AssetUploadUrl

        @required
        expiresAt: Timestamp
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
