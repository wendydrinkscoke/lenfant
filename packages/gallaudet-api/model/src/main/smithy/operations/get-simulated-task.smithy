$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#ExperienceId
use llc.civictech.school#TaskInstanceView

/// Retrieves a simulated task view for a catalog entry in a given project.
@readonly
@http(method: "GET", uri: "/projects/{experienceId}/task-catalog/{entryId}/simulated-task")
@handler(language: "typescript")
operation GetSimulatedTask {
    input := {
        /// Experience that owns the catalog entry.
        @required
        @httpLabel
        experienceId: ExperienceId

        /// Catalog entry to simulate as a task instance view.
        @required
        @httpLabel
        entryId: CatalogEntryId
    }
    output := {
        /// Render-ready task view with presigned asset URLs.
        @required
        task: TaskInstanceView
    }
    errors: [
        NotFoundError
        NotAuthorizedError
        InternalFailureError
    ]
}
