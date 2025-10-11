$version: "2"
namespace org.bartholdi

use aws.protocols#restJson1

/// A sample smithy api
@restJson1
service Bartholdi {
    version: "1.0"
    operations: [
      GetCongressInfo
      SaveDeviceToken
      NotifyPlayer
    ]
    errors: [
      BadRequestError
      NotAuthorizedError
      InternalFailureError
    ]
}