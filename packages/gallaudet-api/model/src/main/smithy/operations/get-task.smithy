$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogTaskInstructions
use llc.civictech.school#CatalogTaskName
use llc.civictech.school#CatalogTaskSubheading
use llc.civictech.school#PartnerName

/// Identifier assigned to a persisted task instance.
@length(min: 1, max: 64)
string TaskInstanceId

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

    /// Partner display name to show alongside the task.
    @required
    partnerName: PartnerName
}

/// Retrieves a persisted task instance if the caller is authorized to view it.
@http(method: "GET", uri: "/task/{taskId}")
@handler(language: "typescript")
operation GetTask {
    input := {
        /// Identifier for the task instance to retrieve.
        @required
        @httpLabel
        taskId: TaskInstanceId
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
