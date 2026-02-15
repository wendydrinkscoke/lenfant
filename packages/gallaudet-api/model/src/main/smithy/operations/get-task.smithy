$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogTaskInstructions
use llc.civictech.school#CatalogTaskName
use llc.civictech.school#CatalogTaskSubheading
use llc.civictech.school#Milestones
use llc.civictech.school#ExperienceName
use llc.civictech.school#AssetIds

/// Details needed to render a task instance inside a Classroom iframe.
structure TaskInstanceView {
    /// Display title presented in the iframe.
    @required
    title: CatalogTaskName

    /// Subtitle shown with the assignment details.
    @required
    subheading: CatalogTaskSubheading

    /// Instructions for the educator or student.
    @required
    instructions: CatalogTaskInstructions

    /// Optional assets attached directly to the task.
    assetIds: AssetIds

    /// Optional milestones that outline partial completion goals.
    milestones: Milestones

    /// Experience display name to show alongside the task.
    @required
    experienceName: ExperienceName

    /// Roblox game ID which informs the play button link
    @required
    robloxGameId: RobloxGameId

    /// Optional assets attached to the owning experience.
    experienceAssetIds: AssetIds
}

/// Retrieves a persisted task instance if the caller is authorized to view it.
@http(method: "GET", uri: "/tasks/{taskId}")
@handler(language: "typescript")
operation GetTask {
    input := {
        /// Identifier for the task instance to retrieve.
        @required
        @httpLabel
        taskId: TaskId
    }
    output := {
        /// Task instance details suitable for rendering in the iframe.
        @required
        task: TaskInstanceView
    }
    errors: [
        NotFoundError
        NotAuthorizedError
        InternalFailureError
    ]
}
