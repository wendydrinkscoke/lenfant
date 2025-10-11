$version: "2"
namespace llc.civictech.school

enum TaskTypes {
    TOUR_WHITEHOUSE = "tour-whitehouse"
    FILIBUSTER = "filibuster"
    DRAFT_BILL = "draft-bill"
    PRESS_BRIEFING = "press-briefing"
    COMMITTEE_HEARING = "committee-hearing"
    CUSTOM = "custom"
}

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

        /// The CivicTech template the teacher selected in the iframe UI.
        @required
        assignmentType: TaskTypes
    }
    output := {
        @required
        message: String
    }
}
