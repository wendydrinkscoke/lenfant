$version: "2"
namespace llc.civictech.school

/// Identifier of the catalog entry within the experience's namespace.
@length(min: 10, max: 50)
@pattern("^[a-z0-9-]+$")
string CatalogEntryId

/// A short, human-readable display name for the task.
@length(min: 10, max: 30)
string CatalogTaskName

/// A brief description displayed alongside the task title.
@length(min: 10, max: 60)
string CatalogTaskSubheading

/// Detailed instructions shown to teachers and students.
@length(min: 1)
string CatalogTaskInstructions

/// Identifier of a milestone within the catalog task entry.
@length(min: 10, max: 50)
@pattern("^[a-z0-9-]+$")
string MilestoneId

/// Human-readable title for a milestone.
@length(min: 10, max: 60)
@pattern("^[A-Za-z0-9](?:[A-Za-z0-9 '\\-]*[A-Za-z0-9])?$")
string MilestoneName

/// A milestone that contributes toward completion of the catalog task.
structure Milestone {
    /// Identifier chosen by the game server for the milestone.
    @required
    id: MilestoneId

    /// Display name shown for this milestone.
    @required
    name: MilestoneName

    /// Percentage credited when the milestone is marked complete.
    @required
    percentageContribution: Percentage

    /// Uploaded assets that should be shown for this milestone.
    assetIds: AssetIds
}

/// Collection of milestones contributing to a catalog task.
list Milestones {
    member: Milestone
}
