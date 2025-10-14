$version: "2"
namespace llc.civictech.school

@sensitive
string RobloxIdToken

/// Associates a Roblox-hosted identity with the currently authenticated Google
/// Classroom user. The caller must already be signed in with Google (to satisfy
/// the API's Cognito authorizer) and must provide the Roblox-backed Cognito ID
/// token that was issued by the Roblox OIDC provider.
@http(method: "POST", uri: "/users/me/linked-identities/roblox")
@handler(language: "typescript")
operation LinkRobloxAccount {
    input := {
        /// The ID token returned by Cognito when completing the Roblox OIDC 
        /// flow. This token proves control of the Roblox identity and is used 
        /// server-side to extract the provider linkage metadata.
        @required
        robloxIdToken: RobloxIdToken
    }
    output := {
        @required
        message: String
    }
}
