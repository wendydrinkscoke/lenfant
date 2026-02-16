$version: "2"
namespace llc.civictech.school

use aws.protocols#restJson1

/// A set of APIs to allow seamless integration of the NUSA Roblox game
/// with Google Classrooms.
@restJson1
service Gallaudet {
    version: "1.0"
    operations: [
      AbortAssetUpload
      AttachTask
      CatalogTask
      CompleteMilestone
      CompleteAssetUpload
      CreateProject
      DelegateGoogleClassroomAccess
      DelegateRobloxSecretStoreAccess
      GetAssetUploadPartUrl
      GetGoogleClassroomAccessStatus
      GetRobloxSecretStoreAccessStatus
      GetLinkedRobloxAccount
      GetTask
      GetTaskCatalog
      GradeTask
      ListProjects
      ListAssets
      ListTasksForPlayer
      LinkRobloxAccount
      PutExperience
      StartAssetUpload
      VendSecret
    ]
    errors: [
      BadRequestError
      InternalFailureError
      NotAuthorizedError
    ]
}
