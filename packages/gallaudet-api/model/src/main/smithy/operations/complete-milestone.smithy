$version: "2"
namespace llc.civictech.school

use llc.civictech.school#MilestoneId
use llc.civictech.school#MilestoneName
use llc.civictech.school#Percentage 
use llc.civictech.school#RobloxUserId
use llc.civictech.school#TaskId

@idempotent
@http(method: "PUT", uri: "/partners/me/players/{robloxUserId}/tasks/{taskId}/milestones/{milestoneId}/completion")
@handler(language: "typescript")
operation CompleteMilestone {
    input := {
        @httpLabel
        @required
        robloxUserId: RobloxUserId

        @httpLabel
        @required
        taskId: TaskId

        @httpLabel
        @required
        milestoneId: MilestoneId
    }
    output := {
        @required
        updatedCumulativePercentage: Percentage

        nextMilestoneId: MilestoneId

        nextMilestoneName: MilestoneName
        
        nextMilestonePercentageContribution: Percentage
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
