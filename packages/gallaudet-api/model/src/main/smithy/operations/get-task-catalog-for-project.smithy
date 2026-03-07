$version: "2"
namespace llc.civictech.school

use llc.civictech.school#ExperienceId
use llc.civictech.school#ExperienceTaskCatalog

/// Retrieves task catalog entries for one project (experience) owned by the caller.
@http(method: "GET", uri: "/projects/{experienceId}/task-catalog")
@handler(language: "typescript")
operation GetTaskCatalogForProject {
    input := {
        /// Experience associated with the project to retrieve task catalog for.
        @required
        @httpLabel
        experienceId: ExperienceId
    }
    output := {
        /// Catalog entries and experience metadata for the requested project.
        @required
        experience: ExperienceTaskCatalog
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
    ]
}
