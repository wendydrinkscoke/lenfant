$version: "2"
namespace org.bartholdi

@readonly
@http(method: "POST", uri: "/players/{playerId}/notifications")
@handler(language: "typescript")
operation NotifyPlayer {
    input := {
        @httpLabel
        @required
        playerId: String

        @required
        title: String
        @required
        subtitle: String
        @required
        body: String
    }
    output := {}
    errors: [NotFoundError]
}
