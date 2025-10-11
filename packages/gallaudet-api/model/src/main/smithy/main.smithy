$version: "2"
namespace llc.civictech.school

use aws.protocols#restJson1

/// A set of APIs to allow seamless integration of the NUSA Roblox game
/// with Google Classrooms.
@restJson1
service Gallaudet {
    version: "1.0"
    operations: [
      DelegateGoogleClassroomAccess
      AttachTask
      LinkRobloxAccount
      CatalogTask
      GetTaskCatalog
    ]
    errors: [
      BadRequestError
      NotAuthorizedError
      InternalFailureError
    ]
}
