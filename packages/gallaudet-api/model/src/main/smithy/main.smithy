$version: "2"
namespace llc.civictech.school

use aws.protocols#restJson1

/// A set of APIs to allow seamless integration of the NUSA Roblox game
/// with Google Classrooms.
@restJson1
service Gallaudet {
    version: "1.0"
    operations: [
      AttachTask
      CatalogTask
      CompleteMilestone
      DelegateGoogleClassroomAccess
      GetGoogleClassroomAccessStatus
      GetTask
      GetTaskCatalog
      GradeTask
      ListTasksForPlayer
      LinkRobloxAccount
      GetLinkedRobloxAccount
      PutPartner
    ]
    errors: [
      BadRequestError
      InternalFailureError
      NotAuthorizedError
    ]
}
