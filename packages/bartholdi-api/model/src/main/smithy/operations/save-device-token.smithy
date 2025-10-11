$version: "2"
namespace org.bartholdi

@readonly
@http(method: "PUT", uri: "/device-token")
@handler(language: "typescript")
operation SaveDeviceToken {
    input := {
        @required
        deviceToken: String

        @required
        uuid: String

        @required
        platform: String
    }
    output := {
        @required
        message: String
    }
    errors: []
}
