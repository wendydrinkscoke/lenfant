$version: "2"
namespace llc.civictech.school

@range(min: 0, max: 100)
byte Percentage

@http(method: "PUT", uri: "/partners/me/players/{robloxUserId}/tasks/{taskId}/grade")
@handler(language: "typescript")
operation GradeTask {
    input := {
        /// Roblox user identifier of the player to whom a grade is being 
        /// assigned.
        @required
        @httpLabel
        robloxUserId: RobloxUserId

        /// Task ID of the task associated with the grade being assigned.
        @required
        @httpLabel
        taskId: TaskId

        /// Grade percentage to assign to the task
        @required
        percentage: Percentage
    }

    output := {
        /// Human-readable confirmation message.
        message: String
    }
}