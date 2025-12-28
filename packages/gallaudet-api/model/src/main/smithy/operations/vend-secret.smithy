$version: "2"
namespace llc.civictech.school

@http(method: "POST", uri: "/projects/{experienceId}/secret")
@handler(language: "typescript")
operation VendSecret {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId
    }
    output := {
        /// Secret identifier created for the newly vended API key.
        @required
        secretId: SecretId

        /// When the previous secret (if any) is scheduled to expire.
        expiresAt: String

        /// Previously active secret identifier, if a rotation occurred.
        previousSecretId: SecretId
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
        SecretAlreadyExistsError
        MissingRequiredRobloxOAuthScopes
    ]
}
