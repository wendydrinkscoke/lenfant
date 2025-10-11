$version: "2"
namespace org.bartholdi

@readonly
@http(method: "GET", uri: "/congress-info")
@handler(language: "typescript")
operation GetCongressInfo {
    input := {
    }
    output := {
        @required
        senateMembers: Integer
    }
    errors: [NotFoundError]
}
