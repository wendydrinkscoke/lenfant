$version: "2"
namespace llc.civictech.school

@sensitive
string RobloxAuthorizationCode

@sensitive
string PkceCodeVerifier


/// An endpoint which receives Roblox OAuth credentials (a code and code verifier) 
/// from the frontend and uses them to call Roblox's token endpoint. The frontend
/// got this code via a redirect back from Roblox after an OAuth flow in which
/// we request permissions to create and list secrets in the calling user's secret
/// store. Note that, in the dialog, the user can select specific experiences for
/// which this permission will be restricted.
@readonly
@http(method: "POST", uri: "/users/me/delegations/roblox-secret-store")
@handler(language: "typescript")
operation DelegateRobloxSecretStoreAccess {
    input := {
        /// The authorization code returned by Roblox. This value must be 
        /// URL-decoded (unescaped) before calling this operation, which is
        /// relevant since this code will come from Roblox in the form of a
        /// query parameter in a redirect.
        @required
        code: RobloxAuthorizationCode

        /// The code verifier which corresponds to the code challenge 
        /// that was passed in the initial redirect to Roblox.
        @required
        code_verifier: PkceCodeVerifier

        /// The redirect URI which was passed in the initial redirect to 
        /// Roblox.
        @required
        redirect_uri: String
    }
    output := {
        @required
        message: String
    }
}