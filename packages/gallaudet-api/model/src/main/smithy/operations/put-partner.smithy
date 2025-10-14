$version: "2"
namespace llc.civictech.school

/// Registers or updates the authenticated partner's profile metadata.
@http(method: "PUT", uri: "/partners/me")
@handler(language: "typescript")
@idempotent
operation PutPartner {
    input := {
        /// Human-friendly name for the partner experience.
        @required
        partnerName: PartnerName

        /// Roblox identifier for the partner's published game.
        @required
        robloxGameId: RobloxGameId
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
