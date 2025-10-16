$version: "2"
namespace llc.civictech.school

use llc.civictech.school#RobloxUserId
use llc.civictech.school#TaskId
use llc.civictech.school#CatalogEntryId

/// A task assigned to a specific Roblox player for this partner.
structure PlayerTaskAssignment {
    /// Unique identifier for the task instance.
    @required
    taskId: TaskId

    /// Identifier for the catalog entry that defines the assignment.
    @required
    entryId: CatalogEntryId
}

list PlayerTaskAssignments {
    member: PlayerTaskAssignment
}

/// Lists the pending tasks for a specific Roblox player within the authenticated partner experience.
@http(method: "GET", uri: "/partners/me/players/{robloxUserId}/tasks")
@handler(language: "typescript")
operation ListTasksForPlayer {
    input := {
        /// Roblox user identifier of the player to query.
        @required
        @httpLabel
        robloxUserId: RobloxUserId
    }
    output := {
        /// Task assignments scoped to the authenticated partner.
        @required
        tasks: PlayerTaskAssignments
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}
