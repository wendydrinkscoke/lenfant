$version: "2"
namespace llc.civictech.school

/// A unique identifier for the Roblox experience/universe.
/// 
/// Based on what I have seen, these identifiers seem to always be twelve-digit 
/// numeric identifiers. This is completely determined by Google, though, and
/// they may change this in the future.
@length(min: 10, max: 10)
@pattern("^[0-9]+$")
string ExperienceId

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
