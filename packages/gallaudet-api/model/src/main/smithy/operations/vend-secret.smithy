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
        @required
        secretId: SecretId
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
        SecretAlreadyExistsError
        MissingRequiredRobloxOAuthScopes
    ]
}
