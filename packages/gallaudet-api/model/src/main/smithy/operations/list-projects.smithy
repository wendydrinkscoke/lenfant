$version: "2"
namespace llc.civictech.school

structure Project {
    experienceId: ExperienceId
    experienceName: ExperienceName
}

list Projects {
    member: Project
}

/// Lists all projects a user has access to view
@http(method: "GET", uri: "/projects")
@handler(language: "typescript")
operation ListProjects {
    input := {
    }
    output := {
        projects: Projects
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
        RobloxLinkRequiredError
    ]
}
