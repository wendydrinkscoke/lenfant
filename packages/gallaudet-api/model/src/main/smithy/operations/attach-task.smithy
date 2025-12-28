$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#PartnerId

/// Creates or updates the Google Classroom attachment associated with the
/// current iframe using one of the predefined CivicTech templates.
@http(method: "POST", uri: "/classrooms/{courseId}/courseWork/{itemId}/attachments")
@handler(language: "typescript")
operation AttachTask {
    input := {
        /// The Google Classroom course identifier associated with the iframe.
        @required
        @httpLabel
        courseId: ClassroomCourseId

        /// The Classroom item identifier (for example, courseWork ID) that the
        /// attachment should be associated with.
        @required
        @httpLabel
        itemId: ClassroomItemId

        /// The raw Google Classroom item type provided to the iframe.
        @required
        itemType: ClassroomItemType

        /// The opaque token Google Classroom passes to the iframe which must
        /// be echoed back when interacting with add-on APIs.
        @required
        addOnToken: AddOnToken

        /// The partner experience ID that owns the catalog entry selected in the iframe UI.
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
