$version: "2"
namespace llc.civictech.school

/// Determines whether offline access to the calling user's Google Classroom
/// scopes has been granted. By offline access, I mean a refresh token exists.
/// 
/// This API is important since knowing If no refresh token exists, let's the
/// frontend guide them either through an auth flow that requests consent or
/// one that happens silently.
@http(method: "GET", uri: "/users/me/delegations/google-classroom/status")
@handler(language: "typescript")
operation GetGoogleClassroomAccessStatus {
    input := {
    }
    output := {
        @required
        delegated: Boolean
    }
}