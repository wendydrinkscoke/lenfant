$version: "2"
namespace llc.civictech.school

/// Registers or updates the authenticated partner's profile metadata.
@http(method: "POST", uri: "/projects/{experienceId}")
@handler(language: "typescript")
operation CreateProject {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId
    }
    output := {
        message: String
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        RobloxLinkRequiredError
        ProjectAlreadyExistsError
        InternalFailureError
    ]
}
