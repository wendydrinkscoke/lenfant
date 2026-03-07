$version: "2"
namespace llc.civictech.school

use llc.civictech.school#AssetIds

/// Registers or updates the authenticated experience's profile metadata.
@http(method: "PUT", uri: "/experiences/me")
@handler(language: "typescript")
@idempotent
operation PutExperience {
    input := {
        /// Roblox identifier for the experience's published game.
        @required
        robloxGameId: RobloxGameId

        /// Optional assets that represent this experience in catalogs and UIs.
        assetIds: AssetIds
    }
    output := {
        message: String
    }
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
    ]
}
