$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetRecords
use llc.civictech.school#ExperienceId

/// Lists assets for the calling user within a specific project.
@http(method: "GET", uri: "/projects/{experienceId}/assets")
@handler(language: "typescript")
operation ListAssets {
    input := {
        /// Experience associated with the project to list assets for.
        @required
        @httpLabel
        experienceId: ExperienceId
    }
    output := {
        /// Assets owned by the calling user for this project.
        @required
        assets: AssetRecords
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
    ]
}
