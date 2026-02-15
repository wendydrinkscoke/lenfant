$version: "2"
namespace llc.civictech.school

use llc.civictech.school#RobloxUserId
use llc.civictech.school#TaskId
use llc.civictech.school#CatalogTaskName
use llc.civictech.school#CatalogTaskSubheading
use llc.civictech.school#CatalogEntryId
use llc.civictech.school#Milestone
use llc.civictech.school#AssetIds

/// A task assigned to a specific Roblox player for this experience.
structure PlayerTaskAssignment {
    @required
    name: CatalogTaskName

    @required
    subheading: CatalogTaskSubheading

    /// Instructions for how to complete the task.
    @required
    instructions: CatalogTaskInstructions

    /// Optional assets attached directly to the task.
    assetIds: AssetIds

    /// Unique identifier for the task instance.
    @required
    taskId: TaskId

    /// Identifier for the catalog entry that defines the assignment.
    @required
    entryId: CatalogEntryId

    /// Next milestone remaining for this player, when a task defines milestones.
    nextMilestone: Milestone

    /// The sum of all the percentContributions for completed milestones if this
    /// task uses milestones. Or, for tasks that aren't milestones, the current
    /// percentage grade in the TaskInstances table for the student.
    cumulativePercentage: Percentage
}

list PlayerTaskAssignments {
    member: PlayerTaskAssignment
}

/// Lists the pending tasks for a specific Roblox player within the authenticated experience experience.
@http(method: "GET", uri: "/experiences/me/players/{robloxUserId}/tasks")
@handler(language: "typescript")
operation ListTasksForPlayer {
    input := {
        /// Roblox user identifier of the player to query.
        @required
        @httpLabel
        robloxUserId: RobloxUserId
    }
    output := {
        /// Task assignments scoped to the authenticated experience.
        @required
        tasks: PlayerTaskAssignments
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}
