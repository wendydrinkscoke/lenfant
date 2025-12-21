$version: "2"
namespace llc.civictech.school

@sensitive
string RobloxApiKey

/// An endpoint which receives a Roblox API key from the frontend for
/// eventual use in creating and updating secrets for the provided
/// universe.
@readonly
@http(method: "POST", uri: "/users/me/delegations/roblox-secret-store")
@handler(language: "typescript")
operation DelegateRobloxSecretStoreAccess {
    input := {
        /// The API key which the developer made in the Roblox Create
        /// Console which grants us permission to list and write In
        /// their Secret Store.
        @required
        apiKey: RobloxApiKey

        @required
        experienceId: ExperienceId
    }
    output := {
        @required
        message: String
    }
}