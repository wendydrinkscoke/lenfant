$version: "2"
namespace llc.civictech.school


/// An API that says hello to the logged-in user.
@http(method: "GET", uri: "/hello")
@handler(language: "typescript")
operation SayHello {
    input := {
    }
    output := {
        /// A message saying hi to the user ID.
        @required
        message: String
    }
}
