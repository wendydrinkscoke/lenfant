$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#PartnerId

/// A token provided by classroom.google.com to the add-on iframe as a query 
/// parameter, which can be used to authorize certain Classroom add-on actions.
/// 
/// https://shorturl.at/piYHg
@sensitive
string AddOnToken

/// Creates or updates the Google Classroom attachment associated with the
/// current iframe using one of the predefined CivicTech templates.
@http(method: "POST", uri: "/classroom-item/task")
@handler(language: "typescript")
operation AttachTask {
    input := {
        /// The Classroom course identifier associated with the iframe.
        @required
        courseId: String

        /// The Classroom item identifier (for example, courseWork ID) that the
        /// attachment should be associated with.
        @required
        itemId: String

        /// The raw Google Classroom item type provided to the iframe.
        @required
        itemType: String

        /// The opaque token Google Classroom passes to the iframe which must
        /// be echoed back when interacting with add-on APIs.
        @required
        addOnToken: AddOnToken

        /// The partner that owns the catalog entry selected in the iframe UI.
        @required
        partnerId: PartnerId

        /// The catalog entry selected in the iframe UI.
        @required
        entryId: CatalogEntryId
    }
    output := {
        @required
        message: String
    }
}
