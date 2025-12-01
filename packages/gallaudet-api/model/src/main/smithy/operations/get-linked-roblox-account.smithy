$version: "2"
namespace llc.civictech.school

@http(method: "GET", uri: "/users/me/linked-identities/roblox")
@handler(language: "typescript")
operation GetLinkedRobloxAccount {
    input := {
    }
    output := {
        @required
        robloxUserId: String
    }
}