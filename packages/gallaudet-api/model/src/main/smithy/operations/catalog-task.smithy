$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#Milestones

/// Creates or updates a task catalog entry for the calling experience.
@idempotent
@http(method: "PUT", uri: "/task-catalog/{entryId}")
@handler(language: "typescript")
operation CatalogTask {
    input := {
        /// Experience-scoped identifier chosen by the game server.
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

        /// Optional milestones that award partial completion percentages.
        milestones: Milestones
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
            instructions: "In this task, you'll be peeing on a statue in game.",
            milestones: [
                {
                    id: "find-the-statue",
                    name: "Find the John Harvard statue",
                    percentageContribution: 50
                },
                {
                    id: "complete-the-tradition",
                    name: "Complete the tradition",
                    percentageContribution: 50
                }
            ]
        }
        output: {
            message: "Task catalog entry saved"
        }
    }
])
