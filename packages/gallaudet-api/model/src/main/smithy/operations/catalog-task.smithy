$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId

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

apply CatalogTask @examples([
    {
        title: "A working example"
        input: {
            entryId: "pee-on-john-harvard-statue",
            name: "Pee on John Harvard Statue",
            subheading: "Participate in a centuries-long urination tradition",
            instructions: "In this task, you'll be peeing on a statue in game."
        }
        output: {
            message: "Task catalog entry saved"
        }
    }
])
