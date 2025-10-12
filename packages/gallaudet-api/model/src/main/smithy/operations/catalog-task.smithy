$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId

/// Permitted grading approaches for cataloged tasks.
enum TaskGradingMethod {
    /// A binary grading model that records whether the assignment was completed.
    SIMPLE_COMPLETION = "simple-completion"
}

/// A short, human-readable display name for the task.
@length(min: 1, max: 30)
string CatalogTaskName

/// A brief description displayed alongside the task title.
@length(min: 1, max: 60)
string CatalogTaskSubheading

/// Detailed instructions shown to teachers and students.
@length(min: 1)
string CatalogTaskInstructions

/// Creates or updates a task catalog entry for the calling partner.
@idempotent
@http(method: "PUT", uri: "/task-catalog/{entryId}")
@handler(language: "typescript")
operation CatalogTask {
    input := {
        /// Partner-scoped identifier chosen by the game server.
        @required
        @httpLabel
        entryId: CatalogEntryId

        /// Display title for the catalog entry.
        @required
        name: CatalogTaskName

        /// Subtitle shown with the task to provide added context.
        @required
        subheading: CatalogTaskSubheading

        /// Instructions visible to educators and students.
        @required
        instructions: CatalogTaskInstructions

        /// Grading approach to use when evaluating student progress.
        @required
        gradingMethod: TaskGradingMethod
    }
    output := {
        /// Human-readable confirmation message.
        @required
        message: String
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
    ]
}
