$version: "2"
namespace llc.civictech.school

/// Determines whether Roblox Secret Store access has been delegated for the
/// specified experience and calling user.
@http(method: "GET", uri: "/projects/{experienceId}/delegations/roblox-secret-store/status")
@handler(language: "typescript")
operation GetRobloxSecretStoreAccessStatus {
    input := {
        @required
        @httpLabel
        experienceId: ExperienceId
    }
    output := {
        @required
        delegated: Boolean
    }
}
