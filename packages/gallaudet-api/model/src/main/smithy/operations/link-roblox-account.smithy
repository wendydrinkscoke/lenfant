$version: "2"
namespace llc.civictech.school

@sensitive
string RobloxIdToken

/// Associates a Roblox-hosted identity with the currently authenticated Google
/// Classroom user. The caller must already be signed in with Google (to satisfy
/// the API's Cognito authorizer) and must provide the Roblox-backed Cognito ID
/// token that was issued by the Roblox OIDC provider.
@http(method: "POST", uri: "/users/me/linked-identities/roblox")
@handler(language: "typescript")
operation LinkRobloxAccount {
    input := {
        /// The ID token returned by Cognito when completing the Roblox OIDC 
        /// flow. This token proves control of the Roblox identity and is used 
        /// server-side to extract the provider linkage metadata.
        @required
        robloxIdToken: RobloxIdToken
    }
    output := {
        @required
        message: String
    }
}

apply LinkRobloxAccount @examples([
    {
        title: "An example with an unlinked Roblox Cognito ID"
        input: {
            robloxIdToken: """
            eyJraWQiOiJzd0JnZlgwcHdobmgrTVRWa0U5Qm1QSFRKNkpYRUt3U3FybzJjWE1ZMmJ\
            jPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoialdCbGJUTnB4LTY3NU4wU2pFVm\
            F5ZyIsInN1YiI6ImU0OTg0NDM4LTkwNjEtNzAxYy0zYmRlLTlhMWY2Yzg5MDg5MyIsI\
            mNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9GS0FrTWZnNnVfUm9ibG94T0lEQyJd\
            LCJjdXN0b206cm9ibG94VXNlcklkIjoiOTY3ODU5NzcxOSIsImlzcyI6Imh0dHBzOlw\
            vXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX0\
            ZLQWtNZmc2dSIsImNvZ25pdG86dXNlcm5hbWUiOiJSb2Jsb3hPSURDXzk2Nzg1OTc3M\
            TkiLCJub25jZSI6IldwUXdoNjRHakxUczJVdGRwYnpDRHI0YW9qU2VlczEzZmtCWXM5\
            YzhmNzBOa1g1VEltb213WWRRWFdqYjJkalMxZVJVeEdmcnEzQmI3cEdjSDRhajNRZXQ\
            xNkZHTFZGcmJyV0tBLVJkRHZtLVhRQVBFQ2VpdlN0ZGhnT0MxX3JjVjEtOHlaS2VoWm\
            J2RndUbTVaMjFyWVQ3d0NmZVpKVTgyaFZOMGczNEpabyIsIm9yaWdpbl9qdGkiOiJmN\
            jQ0YzFjYS1mNzJiLTQ3NTMtOWJmZC0zODNiOTkwMTE5NjQiLCJhdWQiOiIxajBocHR0\
            Njc4anFwaG52cXNuZTNudTB2ciIsImlkZW50aXRpZXMiOlt7ImRhdGVDcmVhdGVkIjo\
            iMTc2MDQ0ODQzODc1OCIsInVzZXJJZCI6Ijk2Nzg1OTc3MTkiLCJwcm92aWRlck5hbW\
            UiOiJSb2Jsb3hPSURDIiwicHJvdmlkZXJUeXBlIjoiT0lEQyIsImlzc3VlciI6bnVsb\
            CwicHJpbWFyeSI6InRydWUifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjox\
            NzYwNDQ4NDQ1LCJleHAiOjE3NjA1MjA0NDUsImlhdCI6MTc2MDQ0ODQ0NSwianRpIjo\
            iZGFmZTljNWEtODc0Mi00MWU2LTlhYWItOTcyYjRhZWFlMWVjIn0.P-NEwY3UDSNPTw\
            QNzaovNSAoZ2zs3lmK62K_Eo57ATDSTP_1FwLVuVF-sFnnxOYHBMmQjtP5a9iOg1AIw\
            YumQcxurNZfSLsQoQxoTN6LN8gWC5QTHY1-BgKq4fNcjqIZtvCS_raXQMfmy6tp83yY\
            FDOV2D3QU9jO6z-zwioSXrQunE1r9R64GV6BDx36A70IYy3n-WK6leEDKXVCOieyheL\
            d5ms44mB-SlDVxVNFtOAkrymd9NDrsO-V0Dy0IF1PZrbvE6z-F9he5mdt8XVRIzOEjE\
            O9c1NnFXGJHzq2zjYDaNddeGtvrqnezOVGr2Qig-bqiuZELyq8jMH-6c1Lew"""
        }
        output: {
            message: "Roblox account linked successfully"
        }
    }
    {
        title: "An example re-linking the same Roblox account",
        input: {
            robloxIdToken: """
            eyJraWQiOiJzd0JnZlgwcHdobmgrTVRWa0U5Qm1QSFRKNkpYRUt3U3FybzJjWE1ZMmJ\
            jPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiVUtfSnNQZ1oteDFBOGd1N2dLUl\
            FhZyIsInN1YiI6IjE0NDhmNDc4LTUwYTEtNzA2Ni1mZWIxLWFlYjIzNzAyNjNmYyIsI\
            mNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9GS0FrTWZnNnVfR29vZ2xlIl0sImN1\
            c3RvbTpyb2Jsb3hVc2VySWQiOiI5Njc4NTk3NzE5IiwiaXNzIjoiaHR0cHM6XC9cL2N\
            vZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfRktBa0\
            1mZzZ1IiwiY29nbml0bzp1c2VybmFtZSI6Ikdvb2dsZV8xMTI4NTIyOTMzOTAwODg3N\
            zQzMzUiLCJub25jZSI6IkxPWUlRZ0k1ZllWT3UzX281Wl93ODJNeXF1SUVBZ3RpdXlP\
            WmoxUmthQ0MtdzVVcjNSNmNWbFhfS3hHQXdWdXR0RTlZNFE5OXRJcEdNRWlwM0RmXy0\
            wUjZxMXltUXNCUmk3elJOdEktUzZjVEpaNXpHN2xPTm9KbTJkdThWcjdWQ0h1RFIxc2\
            50RUxETFpxSmxLMkkyMTU3ZVpCSTNjbnNCQ3Y5RUhfQzYtNCIsIm9yaWdpbl9qdGkiO\
            iI1NWI2ZGY4Ny05Nzg3LTRlZGEtYjliYS0xMmNmMWExOTE0ZjkiLCJhdWQiOiIxajBo\
            cHR0Njc4anFwaG52cXNuZTNudTB2ciIsImlkZW50aXRpZXMiOlt7ImRhdGVDcmVhdGV\
            kIjoiMTc2MDMwNTMyMTEzNiIsInVzZXJJZCI6IjExMjg1MjI5MzM5MDA4ODc3NDMzNS\
            IsInByb3ZpZGVyTmFtZSI6Ikdvb2dsZSIsInByb3ZpZGVyVHlwZSI6Ikdvb2dsZSIsI\
            mlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUifSx7ImRhdGVDcmVhdGVkIjoiMTc2\
            MDQ0NjUzMTc0NiIsInVzZXJJZCI6Ijk2Nzg1OTc3MTkiLCJwcm92aWRlck5hbWUiOiJ\
            Sb2Jsb3hPSURDIiwicHJvdmlkZXJUeXBlIjoiT0lEQyIsImlzc3VlciI6bnVsbCwicH\
            JpbWFyeSI6ImZhbHNlIn1dLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTc2M\
            DQ0ODI4OCwiZXhwIjoxNzYwNTIwMjg4LCJpYXQiOjE3NjA0NDgyODgsImp0aSI6ImI0\
            NTg1ZjU1LTBhMzYtNDI0YS1hMzhiLTE4MDA4ZjE4OTQ2ZiJ9.fwR2Du9KJ6eAguEYer\
            kqyLBuNspTK7WZHUITfws-ILSz3G6XyzIoVayAAyb8lJO2IEjrW0dHZDaRDKrKjnb-P\
            DLfTR8LPWzCqBBA1NI45xTKfjEmaRocwMqyqi_XnyS0bfkS2N0r5McxkwWQMAT-Ma20\
            CSGNI2yjvq5gEEboFVx8YfHPWMC3QFyLQg1PKNZc-Z4oB0ceHz4SvMHIkksshsCjDUq\
            WzMR7zO-9__L1OA-YDHzbt3jPtVU3px6YI1l4UWqyoP0eRqv9yUCNMl0ECEgMgnRhy5\
            eYAwlJHxN5rEsIDW6Mk9fePEj-iAXEv5MuCA8B3_MYKglQbX6iB89Fiw"""
        }
        output: {
            message: "Roblox account already linked"
        }
    }
])