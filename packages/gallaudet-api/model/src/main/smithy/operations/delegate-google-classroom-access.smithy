$version: "2"
namespace llc.civictech.school

@sensitive
string GoogleAuthorizationCode

@sensitive
string PkceCodeVerifier


/// An endpoint which receives Google OAuth credentials (a code and code verifier) 
/// from the frontend and uses them to call Google's token endpoint. The frontend
/// gets this code via a redirect back from Google after an OAuth flow in which
/// we request permissions to manage their classroom.
@readonly
@http(method: "POST", uri: "/users/me/google-classroom/delegations")
@handler(language: "typescript")
operation DelegateGoogleClassroomAccess {
    input := {
        /// The authorization code returned by Google OAuth. This value
        /// must be URL-decoded (unescaped) before calling this operation, 
        /// which is relevant since this code will come from Google in the
        /// form of a query parameter in a redirect.
        @required
        code: GoogleAuthorizationCode

        /// The code verifier which corresponds to the code challenge 
        /// that was passed in the initial redirect to Google.
        @required
        code_verifier: PkceCodeVerifier

        /// The redirect URI which was passed in the initial redirect to 
        /// Google.
        @required
        redirect_uri: String
    }
    output := {
        @required
        message: String
    }
}

apply DelegateGoogleClassroomAccess @examples([
    {
        title: "A working example"
        input: {
            code: "4/0ABCDeFgHIJk123a1TwoThREE4_FivE8doByPnFpErRyZpL4TyPUsIs3gentPDctD0F3nsh"
            code_verifier: "dEs4YYgvqZl1.tj2g6ih_b1IK.-aQ1~CMPmq9qpNJ~eVCKG_bM~iiXErwNdqq0So"
            redirect_uri: "https://beta.school.civictech.llc/google/callback"
        },
        output: {
            message: "Success"
        }
    },
    {
        title: "A failing example"
        input: {
            code: "4/0AXYZbJhK1-12A3xt_abjZYtN6u-vu7D6tMo75Z5VL9FSRW0MKNYTf1gwvNTM6OY73z7vX6"
            code_verifier: "a7w~-aBtsNXAiGEntRRuREm8C1fHz3uIFoydSrlFKzI8FqMYQfayxaEezlmD0QZi"
            redirect_uri: "https://beta.school.civictech.llc/google/callback"
        },
        output: {
            message: "Invalid grant"
        }
    },
    {
        title: "A failing example"
        input: {
            code: "4/0AXYZbJhK1-12A3xt_abjZYtN6u-vu7D6tMo75Z5VL9FSRW0MKNYTf1gwvNTM6OY73z7vX6"
            code_verifier: "a7w~-aBtsNXAiGEntRRuREm8C1fHz3uIFoydSrlFKzI8FqMYQfayxaEezlmD0QZi"
            redirect_uri: "https://beta.school.civictech.llc/google/callback"
        },
        output: {
            message: "Failed to exchange authorization code for tokens"
        }
    }
])